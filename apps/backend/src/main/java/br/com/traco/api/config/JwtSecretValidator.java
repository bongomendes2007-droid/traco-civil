package br.com.traco.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Valida que JWT_SECRET está configurado corretamente em produção.
 * Falha rápido se a secret estiver ausente ou fraca demais.
 */
@Component
@Profile("prod")
public class JwtSecretValidator {

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @EventListener(ApplicationReadyEvent.class)
    public void validate() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET não configurado para profile 'prod'. " +
                "Defina a variável de ambiente JWT_SECRET com pelo menos 32 caracteres."
            );
        }
        if (jwtSecret.length() < 32) {
            throw new IllegalStateException(
                "JWT_SECRET muito curto para profile 'prod' (" + jwtSecret.length() + " chars). " +
                "Mínimo exigido: 32 caracteres."
            );
        }
    }
}