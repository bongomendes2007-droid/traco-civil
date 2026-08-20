package br.com.traco.api.security;

import br.com.traco.api.exception.ApiException;
import br.com.traco.api.model.User;
import br.com.traco.api.repo.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class CurrentUser {

    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User require() {
        return optional().orElseThrow(() -> new ApiException("Não autenticado.", 401));
    }

    public Optional<User> optional() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof String email)) {
            return Optional.empty();
        }
        return userRepository.findByEmail(email);
    }
}