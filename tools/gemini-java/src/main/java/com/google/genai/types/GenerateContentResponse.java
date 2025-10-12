package com.google.genai.types;

import java.util.Optional;
import java.util.List;

public class GenerateContentResponse {
    private Optional<List<Candidate>> candidates = Optional.empty();

    public Optional<List<Candidate>> candidates() { return candidates; }

    public static class Candidate {
        private Optional<Content> content = Optional.empty();
        public Optional<Content> content() { return content; }
        public static Candidate fromContent(Content c) { Candidate ca = new Candidate(); ca.content = Optional.ofNullable(c); return ca; }
    }
}
