package com.example;

import com.google.common.collect.ImmutableList;
import com.google.genai.Client;
import com.google.genai.ResponseStream;
import com.google.genai.types.Blob;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import org.apache.tika.mime.MimeTypeException;
import org.apache.tika.mime.MimeTypes;

import java.io.FileOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class App {
    private static final String MODEL = "gemini-2.5-flash-image";
    private static final String SYSTEM_INSTRUCTION = "40-page list of \u201cBold & Easy\u201d animal designs is finalized.\n\nAll pages should be created on 8.5 x 8.5\" canvas, bold/thick outlines, single animal per page, simple or minimal background.\n\nFinalized Animal List for Interior:\n\nPlayful puppy\nCurious kitten\nSmiling cow\nSleepy pig\nHappy horse\nFriendly sheep\nFluffy bunny\nProud rooster\nGentle duck\nWise owl\nAdorable chick\nCheery lion\nJungle elephant\nFunny monkey\nChill sloth\nSnuggly panda\nClever fox\nBrave tiger\nPatient turtle\nColorful parrot\nProud peacock\nShy deer\nMajestic giraffe\nHappy bear\nLively squirrel\nPlayful dolphin\nSpiky hedgehog\nJoyful penguin\nSmiling shark\nFriendly raccoon\nCheeky goat\nHappy llama\nElegant flamingo\nCuddly koala\nMagical unicorn-cat (hybrid)\nDinosaur-dog (hybrid)\nCow-corn (cow-unicorn hybrid)\nPig-a-saurus (pig-dinosaur hybrid)\nCat-mander (cat salamander hybrid)\nBonus: Animal dance party (group, simple)";

    static void saveBinaryFile(String fileName, byte[] content) {
        try (FileOutputStream out = new FileOutputStream(fileName)) {
            out.write(content);
            System.out.println("Saved file: " + fileName);
        } catch (IOException e) {
            System.err.println("Error saving file: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        String apiKey = System.getenv("GEMINI_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) {
            System.err.println("GEMINI_API_KEY environment variable not set.");
            return;
        }

        Client client = Client.builder().apiKey(apiKey).build();
        MimeTypes allTypes = MimeTypes.getDefaultMimeTypes();

        List<Content> contents = ImmutableList.of(
                Content.builder()
                        .role("user")
                        .parts(ImmutableList.of(Part.fromText("add the title please")))
                        .build()
        );

        GenerateContentConfig config = GenerateContentConfig.builder()
                .responseModalities(ImmutableList.of("IMAGE", "TEXT"))
                .systemInstruction(Content.fromParts(Part.fromText(SYSTEM_INSTRUCTION)))
                .build();

        try (ResponseStream<GenerateContentResponse> responseStream = client.models.generateContentStream(MODEL, contents, config)) {
            for (GenerateContentResponse res : responseStream) {
                Optional<List<Part>> partsOpt = res.candidates().flatMap(cands -> cands.stream().findFirst())
                        .flatMap(cand -> cand.content().flatMap(Content::parts));
                if (partsOpt.isEmpty()) continue;

                for (Part part : partsOpt.get()) {
                    if (part.inlineData().isPresent()) {
                        Blob inlineData = part.inlineData().get();
                        String mimeType = inlineData.mimeType().orElse("application/octet-stream");
                        String fileExtension;
                        try {
                            fileExtension = allTypes.forName(mimeType).getExtension();
                        } catch (MimeTypeException e) {
                            fileExtension = "";
                        }
                        String fileName = "image_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + "_" + UUID.randomUUID() + fileExtension;
                        saveBinaryFile(fileName, inlineData.data().orElse(new byte[0]));
                    } else if (part.text() != null && !part.text().isEmpty()) {
                        System.out.println(part.text());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error during content generation: " + e.getMessage());
        }
    }
}
