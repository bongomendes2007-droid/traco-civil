package br.com.traco.api.controller;

import br.com.traco.api.config.RlsContext;
import br.com.traco.api.dto.Dtos.AuthResponse;
import br.com.traco.api.dto.Dtos.LoginRequest;
import br.com.traco.api.dto.Dtos.RegisterRequest;
import br.com.traco.api.dto.Dtos.UserDto;
import br.com.traco.api.security.CurrentUser;
import br.com.traco.api.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String COOKIE_NAME = "traco_token";

    private final AuthService authService;
    private final CurrentUser currentUser;
    private final String cookieSameSite;
    private final long jwtExpirationMs;

    public AuthController(AuthService authService,
                          CurrentUser currentUser,
                          @Value("${app.cookie.samesite:Strict}") String cookieSameSite,
                          @Value("${app.jwt.expiration-ms}") long jwtExpirationMs) {
        this.authService = authService;
        this.currentUser = currentUser;
        this.cookieSameSite = cookieSameSite;
        this.jwtExpirationMs = jwtExpirationMs;
    }

    @PostMapping("/register")
    public UserDto register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        // Set email in RLS context BEFORE calling the @Transactional service.
        // Spring obtains the DB connection when the transaction starts (at service entry),
        // so the wrapper must see the email in ThreadLocal at that point to allow
        // INSERT ... RETURNING via the users_select_own SELECT policy.
        if (request.email() != null) {
            RlsContext.setEmail(request.email().toLowerCase().trim());
        }
        try {
            AuthResponse authResponse = authService.register(request);
            setAuthCookie(httpRequest, response, authResponse.token());
            return authResponse.user();
        } finally {
            RlsContext.clear();
        }
    }

    @PostMapping("/login")
    public UserDto login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        // Set email in RLS context BEFORE calling the @Transactional service.
        // Spring obtains the DB connection when the transaction starts (at service entry),
        // so the RlsDataSourceWrapper must see the email in ThreadLocal at that point
        // to apply SET LOCAL app.current_user_email correctly for audit_log INSERTs.
        if (request.email() != null) {
            RlsContext.setEmail(request.email().toLowerCase().trim());
        }
        try {
            AuthResponse authResponse = authService.login(request);
            setAuthCookie(httpRequest, response, authResponse.token());
            return authResponse.user();
        } finally {
            RlsContext.clear();
        }
    }

    @PostMapping("/logout")
    public void logout(HttpServletRequest httpRequest, HttpServletResponse response) {
        clearAuthCookie(httpRequest, response);
    }

    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(currentUser.require());
    }

    private void setAuthCookie(HttpServletRequest request, HttpServletResponse response, String token) {
        // maxAge ALINHADO à expiração real do JWT — o cookie não deve sobreviver
        // ao token, senão o middleware do Next vê "sessão" após expiração e
        // rebota /login de volta às páginas protegidas (loop de redirect).
        long maxAgeSeconds = Math.max(1, jwtExpirationMs / 1000);

        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, token)
                .httpOnly(true)
                .secure(request.isSecure()) // true em HTTPS (prod), false em dev HTTP
                .path("/")
                .maxAge(maxAgeSeconds)
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearAuthCookie(HttpServletRequest request, HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(request.isSecure())
                .path("/")
                .maxAge(0)
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}