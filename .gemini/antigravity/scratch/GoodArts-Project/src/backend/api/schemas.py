"""
ArtLog — Pydantic Schemas
All request/response models for the API.
"""
from typing import Optional, Any
from pydantic import BaseModel, Field


# ─── Artwork ─────────────────────────────────────────────────────────────────

class ArtworkBase(BaseModel):
    title: str
    artist: Optional[str] = None
    year: Optional[int] = None
    medium: Optional[str] = None
    movement: Optional[str] = None
    era: Optional[str] = None
    museum: Optional[str] = None
    museum_city: Optional[str] = None
    museum_country: Optional[str] = None
    image_url: Optional[str] = None
    image_url_hd: Optional[str] = None
    description: Optional[str] = None
    wikidata_id: Optional[str] = None
    europeana_id: Optional[str] = None
    source: str = "manual"


class ArtworkCreate(ArtworkBase):
    pass


class ArtworkOut(ArtworkBase):
    id: int

    class Config:
        from_attributes = True


# ─── User Artwork (Checklist / Bucket) ───────────────────────────────────────

class AddToListRequest(BaseModel):
    artwork_id: int
    list_type: str = Field(..., pattern="^(seen|bucket)$")
    rating: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = None
    date_seen: Optional[str] = None
    museum_visited: Optional[str] = None
    priority: Optional[int] = Field(3, ge=1, le=5)


class UserArtworkOut(BaseModel):
    id: int
    artwork_id: int
    list_type: str
    rating: Optional[int] = None
    notes: Optional[str] = None
    date_seen: Optional[str] = None
    museum_visited: Optional[str] = None
    priority: Optional[int] = None
    added_at: Optional[str] = None
    # Joined artwork fields
    title: Optional[str] = None
    artist: Optional[str] = None
    year: Optional[int] = None
    movement: Optional[str] = None
    medium: Optional[str] = None
    museum: Optional[str] = None
    museum_city: Optional[str] = None
    image_url: Optional[str] = None
    image_url_hd: Optional[str] = None
    era: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Onboarding ──────────────────────────────────────────────────────────────

class OnboardingRateRequest(BaseModel):
    wikidata_id: str
    rating: int = Field(..., ge=1, le=5)


class OnboardingArtwork(BaseModel):
    wikidata_id: str
    title: str
    artist: Optional[str] = None
    movement: Optional[str] = None
    year: Optional[int] = None
    image_url: Optional[str] = None
    image_url_hd: Optional[str] = None


# ─── Museum Visits ────────────────────────────────────────────────────────────

class MuseumVisitCreate(BaseModel):
    museum_name: str
    city: Optional[str] = None
    country: Optional[str] = None
    visit_date: Optional[str] = None
    notes: Optional[str] = None


class MuseumVisitOut(MuseumVisitCreate):
    id: int
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Stats ────────────────────────────────────────────────────────────────────

class StatsOut(BaseModel):
    seen_count: int
    bucket_count: int
    avg_rating: float
    visit_count: int


# ─── Search ──────────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    local: list[ArtworkOut] = []
    remote: list[ArtworkBase] = []
    suggestion: Optional[str] = None


# ─── Recommendations ─────────────────────────────────────────────────────────

class RecommendedArtwork(BaseModel):
    artwork: ArtworkOut
    score: float
    reasons: list[str] = []


class MuseumRecommendation(BaseModel):
    museum_name: str
    city: Optional[str] = None
    country: Optional[str] = None
    why: Optional[str] = None
    wikidata_id: Optional[str] = None


class RecommendationsOut(BaseModel):
    personalized_artworks: list[RecommendedArtwork] = []
    must_see_artworks: list[ArtworkOut] = []
    personalized_museums: list[MuseumRecommendation] = []
    popular_museums: list[MuseumRecommendation] = []


# ─── Feed ────────────────────────────────────────────────────────────────────

class FeedItem(BaseModel):
    artwork: "ArtworkOut"
    slot_type: str
    score: float = 0
    probe_type: Optional[str] = None
    expected_signal: Optional[str] = None


class DailyMasterpiece(BaseModel):
    artwork: "ArtworkOut"
    fun_facts: list = []


class TasteSignal(BaseModel):
    artwork_id: int
    weight: int = Field(..., ge=-1, le=5)
    probe_type: Optional[str] = None
    expected_signal: Optional[str] = None


# ─── Enrichment ──────────────────────────────────────────────────────────────

class EnrichmentOut(BaseModel):
    artwork_id: Optional[int] = None
    formal_analysis: Optional[str] = None
    technique_notes: Optional[str] = None
    iconography: Optional[str] = None
    movement_context: Optional[str] = None
    historical_period: Optional[str] = None
    impact_on_art: Optional[str] = None
    contemporary_rel: Optional[str] = None
    provenance: Optional[str] = None
    artist_context: Optional[str] = None
    fun_facts: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Exhibitions ─────────────────────────────────────────────────────────────

class ExhibitionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    venue_name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    image_url: Optional[str] = None
    source: str = "manual"
    url: Optional[str] = None


class ExhibitionOut(ExhibitionCreate):
    id: int
    taste_affinity: float = 0.0
    movement_tags: Optional[str] = None
    artist_tags: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ExhibitionDetailOut(ExhibitionOut):
    recommended_artworks: list[ArtworkOut] = []
    recommended_artists: list[str] = []
    all_artworks: list[ArtworkOut] = []
    personal_notes: Optional[str] = None
    status: Optional[str] = "interested"


class ExhibitionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(interested|attending|visited|none)$")
    notes: Optional[str] = None


# ─── Visits ──────────────────────────────────────────────────────────────────

class VisitCreate(BaseModel):
    venue_name: str
    city: Optional[str] = None
    country: Optional[str] = None
    visit_date: Optional[str] = None
    overall_notes: Optional[str] = None
    overall_rating: Optional[float] = Field(None, ge=1, le=5)
    duration_min: Optional[int] = None
    exhibition_id: Optional[int] = None


class VisitOut(VisitCreate):
    id: int
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Annotations ─────────────────────────────────────────────────────────────

class AnnotationCreate(BaseModel):
    note_text: Optional[str] = None
    photo_id: Optional[int] = None


class AnnotationOut(BaseModel):
    id: int
    artwork_id: int
    note_text: Optional[str] = None
    photo_id: Optional[int] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Personal Logs ───────────────────────────────────────────────────────────

class PersonalLogCreate(BaseModel):
    artwork_id: Optional[int] = None
    visit_id: Optional[int] = None
    title: Optional[str] = None
    content: str

class PersonalLogOut(PersonalLogCreate):
    id: int
    created_at: str

    model_config = {"from_attributes": True}


# ─── Settings ────────────────────────────────────────────────────────────────

class SettingsOut(BaseModel):
    home_city: Optional[str] = None
    home_country: Optional[str] = None
    temp_city: Optional[str] = None
    onboarding_done: Optional[bool] = None

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    home_city: Optional[str] = None
    home_country: Optional[str] = None
    temp_city: Optional[str] = None


# ─── Technical Dossier ───────────────────────────────────────────────────────

class DossierOut(BaseModel):
    """Response model for GET /artworks/{id}/dossier."""
    status: str  # "complete" | "enriching" | "unavailable"
    artwork_id: Optional[int] = None
    data_sources: Optional[list[str]] = None
    materials: Optional[dict[str, Any]] = None
    physical: Optional[dict[str, Any]] = None
    color_palette: Optional[list[dict]] = None
    classification: Optional[dict[str, Any]] = None
    movement: Optional[dict[str, Any]] = None
    lineage: Optional[dict[str, Any]] = None
    artist: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}
