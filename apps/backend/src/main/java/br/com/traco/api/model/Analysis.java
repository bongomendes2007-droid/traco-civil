package br.com.traco.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "analyses")
public class Analysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code; // ANL-0047

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "planta_id")
    private Planta planta;

    @Column(nullable = false)
    private String status; // concluida | revisada | processando | erro

    private Integer durationSeconds;
    private Integer confidence;
    private Double area;
    private Integer rooms;
    private Double estimatedCost;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String elementsJson; // [{"label":"Pilares","value":"24"},...]

    @Lob
    @Column(columnDefinition = "TEXT")
    private String quantitiesJson; // [{"label":"Concreto","value":"32,45 m³"},...]

    @Lob
    @Column(columnDefinition = "TEXT")
    private String boxesJson; // [{"x":0.5,"y":0.08,"w":0.43,"h":0.40,"area_m2":34.9},...]

    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public Planta getPlanta() { return planta; }
    public void setPlanta(Planta planta) { this.planta = planta; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    public Integer getConfidence() { return confidence; }
    public void setConfidence(Integer confidence) { this.confidence = confidence; }
    public Double getArea() { return area; }
    public void setArea(Double area) { this.area = area; }
    public Integer getRooms() { return rooms; }
    public void setRooms(Integer rooms) { this.rooms = rooms; }
    public Double getEstimatedCost() { return estimatedCost; }
    public void setEstimatedCost(Double estimatedCost) { this.estimatedCost = estimatedCost; }
    public String getElementsJson() { return elementsJson; }
    public void setElementsJson(String elementsJson) { this.elementsJson = elementsJson; }
    public String getQuantitiesJson() { return quantitiesJson; }
    public void setQuantitiesJson(String quantitiesJson) { this.quantitiesJson = quantitiesJson; }
    public String getBoxesJson() { return boxesJson; }
    public void setBoxesJson(String boxesJson) { this.boxesJson = boxesJson; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}