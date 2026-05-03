"""
GoodArts - Test Artwork Seed Data
Seeded on first startup so the feed tab displays multiple artworks for testing.
Diverse collection spanning movements, periods, and styles.
"""
import hashlib


def _wikimedia_thumb(filename: str, width: int = 1280) -> str:
    """Derive the Wikimedia Commons thumbnail URL for a given filename."""
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return (
        f"https://upload.wikimedia.org/wikipedia/commons/thumb"
        f"/{md5[0]}/{md5[:2]}/{filename}/{width}px-{filename}"
    )


_VENUS_FILE = "Sandro_Botticelli_-_La_nascita_di_Venere.jpg"
_VENUS_URL = _wikimedia_thumb(_VENUS_FILE)

TEST_ARTWORKS_SEED = [
    {
        "title": "Girl with a Pearl Earring",
        "artist": "Johannes Vermeer",
        "year": 1665,
        "medium": "Oil on canvas",
        "movement": "Dutch Golden Age",
        "era": "Baroque",
        "museum": "Mauritshuis",
        "museum_city": "The Hague",
        "museum_country": "Netherlands",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/0/0f/1665_Girl_with_a_Pearl_Earring.jpg",
        "description": "Vermeer's masterpiece of intimate portraiture, capturing a moment of quiet beauty with transcendent light.",
        "wikidata_id": "Q185953",
        "source": "seed",
    },
    {
        "title": "The Birth of Venus",
        "artist": "Sandro Botticelli",
        "year": 1484,
        "medium": "Tempera on canvas",
        "movement": "Renaissance",
        "era": "Early Renaissance",
        "museum": "Uffizi Gallery",
        "museum_city": "Florence",
        "museum_country": "Italy",
        "image_url": _VENUS_URL,
        "description": "One of the most iconic Renaissance paintings, depicting the goddess Venus emerging from the sea in ethereal beauty.",
        "wikidata_id": "Q6349",
        "source": "seed",
    },
    {
        "title": "Starry Night",
        "artist": "Vincent van Gogh",
        "year": 1889,
        "medium": "Oil on canvas",
        "movement": "Post-Impressionism",
        "era": "Late 19th century",
        "museum": "Museum of Modern Art",
        "museum_city": "New York",
        "museum_country": "United States",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
        "description": "Van Gogh's swirling vision of the night sky, expressing emotion through bold brushwork and vibrant color.",
        "wikidata_id": "Q24236",
        "source": "seed",
    },
    {
        "title": "The Persistence of Memory",
        "artist": "Salvador Dalí",
        "year": 1931,
        "medium": "Oil on canvas",
        "movement": "Surrealism",
        "era": "20th century",
        "museum": "Museum of Modern Art",
        "museum_city": "New York",
        "museum_country": "United States",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/d/dd/The_Persistence_of_Memory.jpg",
        "description": "Dalí's dreamlike masterpiece of melting clocks in a desolate landscape, exploring the nature of time and memory.",
        "wikidata_id": "Q183134",
        "source": "seed",
    },
    {
        "title": "American Gothic",
        "artist": "Grant Wood",
        "year": 1930,
        "medium": "Oil on beaverboard",
        "movement": "American Regionalism",
        "era": "20th century",
        "museum": "Art Institute of Chicago",
        "museum_city": "Chicago",
        "museum_country": "United States",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/c/cc/Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg",
        "description": "Wood's iconic portrait of American rural life, celebrated as a defining image of the American spirit.",
        "wikidata_id": "Q269593",
        "source": "seed",
    },
    {
        "title": "The Great Wave off Kanagawa",
        "artist": "Katsushika Hokusai",
        "year": 1830,
        "medium": "Woodblock print",
        "movement": "Ukiyo-e",
        "era": "Edo period",
        "museum": "Metropolitan Museum of Art",
        "museum_city": "New York",
        "museum_country": "United States",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/0/0a/The_Great_Wave_off_Kanagawa.jpg",
        "description": "Hokusai's dramatic composition capturing a massive wave with Mount Fuji serene in the background.",
        "wikidata_id": "Q948421",
        "source": "seed",
    },
    {
        "title": "Wanderer Above the Sea of Fog",
        "artist": "Caspar David Friedrich",
        "year": 1818,
        "medium": "Oil on canvas",
        "movement": "Romanticism",
        "era": "Early 19th century",
        "museum": "Hamburger Kunsthalle",
        "museum_city": "Hamburg",
        "museum_country": "Germany",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/b/b9/Caspar_David_Friedrich_-_Wanderer_Above_the_Sea_of_Fog.jpg",
        "description": "Friedrich's contemplative figure gazing across misty peaks, embodying Romantic ideals of solitude and sublime nature.",
        "wikidata_id": "Q12417",
        "source": "seed",
    },
    {
        "title": "A Sunday Afternoon on the Island of La Grande Jatte",
        "artist": "Georges Seurat",
        "year": 1886,
        "medium": "Oil on canvas",
        "movement": "Neo-Impressionism",
        "era": "Late 19th century",
        "museum": "Art Institute of Chicago",
        "museum_city": "Chicago",
        "museum_country": "United States",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg",
        "description": "Seurat's monumental pointillist composition of Parisians at leisure, combining scientific color theory with social observation.",
        "wikidata_id": "Q308155",
        "source": "seed",
    },
    {
        "title": "The Bedroom",
        "artist": "Vincent van Gogh",
        "year": 1889,
        "medium": "Oil on canvas",
        "movement": "Post-Impressionism",
        "era": "Late 19th century",
        "museum": "Art Institute of Chicago",
        "museum_city": "Chicago",
        "museum_country": "United States",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/7/76/Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg",
        "description": "Van Gogh's intimate depiction of his bedroom at the Yellow House in Arles, rendered in bold colors and simplified forms.",
        "wikidata_id": "Q215147",
        "source": "seed",
    },
    {
        "title": "Las Meninas",
        "artist": "Diego Velázquez",
        "year": 1656,
        "medium": "Oil on canvas",
        "movement": "Baroque",
        "era": "Spanish Golden Age",
        "museum": "Museo del Prado",
        "museum_city": "Madrid",
        "museum_country": "Spain",
        "image_url": _wikimedia_thumb("Las_Meninas,_by_Diego_Vel\u00e1zquez,_from_Prado_in_Google_Earth.jpg"),
        "description": "Velázquez's complex masterpiece of the Spanish royal court, a pivotal work exploring perspective, light, and the nature of painting.",
        "wikidata_id": "Q1656",
        "source": "seed",
    },
]


def get_test_artworks_seed():
    return TEST_ARTWORKS_SEED
