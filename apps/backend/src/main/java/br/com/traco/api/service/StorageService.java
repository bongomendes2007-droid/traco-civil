package br.com.traco.api.service;

import br.com.traco.api.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class StorageService {

    private final Path root;

    public StorageService(@Value("${app.upload.dir}") String dir) {
        this.root = Paths.get(dir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public String store(MultipartFile file) {
        String original = file.getOriginalFilename() == null ? "arquivo" : file.getOriginalFilename();
        String safe = UUID.randomUUID() + "-" + original.replaceAll("[^a-zA-Z0-9._-]", "_");
        Path target = root.resolve(safe);
        try {
            file.transferTo(target);
        } catch (IOException e) {
            throw new ApiException("Falha ao salvar o arquivo no servidor.", 500);
        }
        return target.toString();
    }
}