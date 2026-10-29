package com.shopmart.api.assistant;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/assistant", "/api/mobile/assistant"})
public class AssistantController {

  private final AssistantService assistant;

  public AssistantController(AssistantService assistant) {
    this.assistant = assistant;
  }

  @PostMapping("/chat")
  public ResponseEntity<ChatResponse> chat(
      @Valid @RequestBody ChatRequest request,
      HttpServletRequest servletRequest) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(new ChatResponse(assistant.reply(request, servletRequest.getRemoteAddr())));
  }

  public record ChatRequest(
      @NotBlank @Pattern(regexp = "en|ur") String language,
      @NotEmpty @Size(max = 12) List<@Valid ChatMessage> messages) {
  }

  public record ChatMessage(
      @NotBlank @Pattern(regexp = "user|assistant") String role,
      @NotBlank @Size(max = 1000) String content) {
  }

  public record ChatResponse(String reply) {
  }
}
