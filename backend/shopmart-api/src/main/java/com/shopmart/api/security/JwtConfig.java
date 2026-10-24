package com.shopmart.api.security;

import java.util.Base64;
import java.util.List;
import java.util.UUID;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

@Configuration
public class JwtConfig {

  public static final String ISSUER = "shopmart";
  public static final String AUDIENCE = "shopmart-api";

  @Bean
  public SecretKey jwtSecretKey(
      @Value("${shopmart.jwt.secret}") String encodedSecret) {

    byte[] bytes = Base64.getDecoder().decode(encodedSecret);

    if (bytes.length < 32) {
      throw new IllegalArgumentException(
          "JWT secret must contain at least 32 random bytes.");
    }

    return new SecretKeySpec(bytes, "HmacSHA256");
  }

  @Bean
  public JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
    return new NimbusJwtEncoder(
        new ImmutableSecret<>(jwtSecretKey));
  }

  @Bean
  public JwtDecoder jwtDecoder(
      SecretKey jwtSecretKey,
      JdbcTemplate jdbc) {

    NimbusJwtDecoder decoder = NimbusJwtDecoder
        .withSecretKey(jwtSecretKey)
        .macAlgorithm(MacAlgorithm.HS256)
        .build();

    JwtClaimValidator<List<String>> audienceValidator = new JwtClaimValidator<>(
        "aud",
        audience -> audience != null
            && audience.contains(AUDIENCE));

    OAuth2TokenValidator<Jwt> standardValidators = new DelegatingOAuth2TokenValidator<>(
        JwtValidators.createDefaultWithIssuer(ISSUER),
        audienceValidator);

    decoder.setJwtValidator(jwt -> {
      // Validate issuer, audience and timestamps before querying the account.
      OAuth2TokenValidatorResult standardResult = standardValidators.validate(jwt);

      if (standardResult.hasErrors()) {
        return standardResult;
      }

      String subject = jwt.getSubject();

      if (subject == null || subject.isBlank()) {
        return invalidAccount();
      }

      UUID userId;

      try {
        userId = UUID.fromString(subject);
      } catch (IllegalArgumentException exception) {
        return invalidAccount();
      }

      Boolean enabled = jdbc.queryForObject("""
          SELECT EXISTS (
              SELECT 1
              FROM public.users
              WHERE id = ?
                AND enabled = TRUE
          )
          """, Boolean.class, userId);

      if (!Boolean.TRUE.equals(enabled)) {
        return invalidAccount();
      }

      return OAuth2TokenValidatorResult.success();
    });

    return decoder;
  }

  private static OAuth2TokenValidatorResult invalidAccount() {
    return OAuth2TokenValidatorResult.failure(
        new OAuth2Error(
            "invalid_token",
            "The account is unavailable. Please sign in again.",
            null));
  }
}