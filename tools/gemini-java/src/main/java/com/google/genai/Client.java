package com.google.genai;

import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;

import java.util.List;

/**
 * Minimal mock Client used for local builds when the real GenAI client is not available.
 * This mock returns an empty ResponseStream. Replace with the official client for real use.
 */
public class Client {
    public final Models models = new Models();

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String apiKey;

        public Builder apiKey(String k) {
            this.apiKey = k;
            return this;
        }

        public Client build() {
            if (this.apiKey == null || this.apiKey.isEmpty()) {
                System.err.println("Warning: GEMINI_API_KEY not set when building Client. Real GenAI client will require a valid API key.");
            }
            return new Client();
        }
    }

    public static class Models {
        public ResponseStream<GenerateContentResponse> generateContentStream(String model, List<Content> contents, GenerateContentConfig config) {
            throw new IllegalStateException("GenAI client not available. To enable the real client, add the official GenAI Java client dependency and build with the 'with-genai' profile, or replace the mock classes. See tools/gemini-java/README.md for details.");
        }
    }
}
