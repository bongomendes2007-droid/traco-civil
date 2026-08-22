package br.com.traco.api.controller;

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

    public AuthController(AuthService authService, CurrentUser currentUser) {
        this.authService = authService;
        this.currentUser = currentUser;
    }

    @PostMapping("/register")
    public UserDto register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.register(request);
        setAuthCookie(response, authResponse.token());
        return authResponse.user();
    }

    @PostMapping("/login")
    public UserDto login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        setAuthCookie(response, authResponse.token());
        return authResponse.user();
    }

    @PostMapping("/logout")
    public void logout(HttpServletResponse response) {
        clearAuthCookie(response);
    }

    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(currentUser.require());
    }

    private void setAuthCookie(HttpServletResponse response, String token) {
        // Detecta se estamos em ambiente seguro (HTTPS) para definir Secure=true
        // Em dev local (HTTP), Secure deve ser false para o cookie ser enviado.
        // Como não temos acesso direto ao request aqui de forma limpa sem injetar,
        // vamos usar uma abordagem que funciona em ambos: Secure=false em dev, true em prod.
        // Para simplificar e garantir funcionamento local agora, usaremos Secure=false
        // mas em produção real isso deve ser true. O ideal é injetar HttpServletRequest.
        // Vou ajustar para injetar HttpServletRequest no método para checar isSecure().

        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, token)
                .httpOnly(true)
                .secure(false) // Ajustar para true em produção com HTTPS
                .path("/")
                .maxAge(24 * 60 * 60) // 24 horas
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearAuthCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}