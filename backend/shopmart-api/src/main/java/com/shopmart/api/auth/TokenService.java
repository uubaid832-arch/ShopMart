package com.shopmart.api.auth;

import java.time.Instant;
import java.util.List;
import com.shopmart.api.security.JwtConfig;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class TokenService {

  public static final long EXPIRES_IN_SECONDS = 900;

  private final JwtEncoder encoder;

  public TokenService(JwtEncoder encoder) {
    this.encoder = encoder;
  }

  public String createToken(UserAccount user) {
    Instant now = Instant.now();

    JwtClaimsSet claims = JwtClaimsSet.builder()
        .issuer(JwtConfig.ISSUER)
        .audience(List.of(JwtConfig.AUDIENCE))
        .subject(user.getId().toString())
        .issuedAt(now)
        .expiresAt(now.plusSeconds(EXPIRES_IN_SECONDS))
        .claim("roles", List.of(user.getRole()))
        .build();

    JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();

    return encoder.encode(
        JwtEncoderParameters.from(header, claims)).getTokenValue();
  }
}