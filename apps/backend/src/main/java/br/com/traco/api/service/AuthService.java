package br.com.traco.api.service;

import br.com.traco.api.config.RlsContext;
import br.com.traco.api.dto.Dtos.AuthResponse;
import br.com.traco.api.dto.Dtos.LoginRequest;
import br.com.traco.api.dto.Dtos.RegisterRequest;
import br.com.traco.api.dto.Dtos.UserDto;
import br.com.traco.api.exception.ApiException;
import br.com.traco.api.model.User;
import br.com.traco.api.repo.UserRepository;
import br.com.traco.api.security.JwtService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginAttemptService loginAttempts;
    private final AuditService auditService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       LoginAttemptService loginAttempts,
                       AuditService auditService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginAttempts = loginAttempts;
        this.auditService = auditService;
    }

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new ApiException("Informe seu nome completo.");
        }
        if (req.email() == null || !req.email().contains("@")) {
            throw new ApiException("E-mail inválido.");
        }
        if (req.password() == null || req.password().length() < 6) {
            throw new ApiException("A senha deve ter pelo menos 6 caracteres.");
        }
        String email = req.email().toLowerCase().trim();
        if (userRepository.existsByEmail(email)) {
            throw new ApiException("E-mail já cadastrado.", 409);
        }

        // Force SET LOCAL inside THIS transaction so that the users_select_own
        // SELECT policy can match the newly inserted row via RETURNING clause.
        // The RlsDataSourceWrapper may have already applied RESET when the
        // connection was checked out (before this method body runs), so we
        // must set the variable explicitly within the active transaction.
        // NOTE: SET LOCAL does not support bind parameters (:param), so we
        // concatenate the value directly with SQL-safe escaping.
        String safeEmail = email.replace("'", "''");
        entityManager.createNativeQuery("SET LOCAL app.current_user_email = '" + safeEmail + "'")
                .executeUpdate();

        User user = new User();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setRole(req.role() == null || req.role().isBlank() ? "engenheiro" : req.role());
        user = userRepository.save(user);
        return new AuthResponse(jwtService.generateToken(user.getId(), user.getEmail()), UserDto.from(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        String email = req.email() == null ? "" : req.email().toLowerCase().trim();

        // Set RLS context FIRST, before any DB access. The RlsDataSourceWrapper
        // reads this ThreadLocal when obtaining a Connection and applies
        // SET LOCAL automatically. This must happen before any repository call
        // or EntityManager query so that ALL connections in this transaction
        // (including those used by AuditService with REQUIRED propagation)
        // have the correct RLS variables set.
        if (!email.isEmpty()) {
            RlsContext.setEmail(email);
        }

        loginAttempts.checkNotLocked(email);

        User user = userRepository.findByEmail(email).orElse(null);
        boolean matches = user != null
                && passwordEncoder.matches(req.password() == null ? "" : req.password(), user.getPassword());

        if (!matches) {
            loginAttempts.recordFailure(email);
            auditService.logLoginFailure(email, "INVALID_CREDENTIALS");
            // Mensagem genérica de propósito: não revela se o e-mail existe.
            throw new ApiException("Credenciais inválidas.", 401);
        }

        loginAttempts.reset(email);
        auditService.logLoginSuccess(user.getId(), user.getEmail());
        return new AuthResponse(jwtService.generateToken(user.getId(), user.getEmail()), UserDto.from(user));
    }
}