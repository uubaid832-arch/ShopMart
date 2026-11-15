package com.shopmart.api.translation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping({"/api/translate", "/api/mobile/translate"})
public class TranslationController {
    private static final String GOOGLE_TRANSLATE_URL =
            "https://translation.googleapis.com/language/translate/v2";
    private static final int MAX_BATCH_CHARACTERS = 4_000;

    private final RestClient restClient;
    private final String apiKey;

    public TranslationController(
            @Value("${shopmart.translation.google-api-key:}") String apiKey) {
        this.restClient = RestClient.create();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TranslationResponse translate(@Valid @RequestBody TranslationRequest request) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "ShopMart Urdu translation is not configured yet.");
        }
        if (request.texts().stream().mapToInt(String::length).sum() > MAX_BATCH_CHARACTERS) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "Translate a smaller batch of text at a time.");
        }

        try {
            UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(GOOGLE_TRANSLATE_URL)
                    .queryParam("key", apiKey)
                    .queryParam("source", "en")
                    .queryParam("target", "ur")
                    .queryParam("format", "text");
            request.texts().forEach(text -> uri.queryParam("q", text));

            GoogleTranslationEnvelope envelope = restClient.post()
                    .uri(uri.build().encode().toUri())
                    .retrieve()
                    .body(GoogleTranslationEnvelope.class);

            List<String> translatedTexts = envelope == null || envelope.data() == null
                    || envelope.data().translations() == null
                    ? List.of()
                    : envelope.data().translations().stream()
                            .map(GoogleTranslationValue::translatedText)
                            .toList();

            if (translatedTexts.size() != request.texts().size()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "The translation provider returned an incomplete result.");
            }
            return new TranslationResponse(translatedTexts);
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "ShopMart could not translate the page right now.");
        }
    }

    public record TranslationRequest(
            @NotEmpty(message = "Provide text to translate.")
            @Size(max = 50, message = "Translate no more than 50 text fragments at once.")
            List<@NotBlank @Size(max = 1_000) String> texts) {}

    public record TranslationResponse(List<String> translatedTexts) {}

    private record GoogleTranslationEnvelope(GoogleTranslationData data) {}

    private record GoogleTranslationData(List<GoogleTranslationValue> translations) {}

    private record GoogleTranslationValue(String translatedText) {}
}
