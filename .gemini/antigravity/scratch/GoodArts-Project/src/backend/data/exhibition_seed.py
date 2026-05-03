"""
GoodArts - Exhibition Seed Data
Seeded on first startup so the Events tab is populated without API credentials.
12 realistic international exhibitions spanning major art movements.
"""

EXHIBITION_SEED = [
    {
        "title": "Van Gogh: The Immersive Experience",
        "venue_name": "MASP - Museu de Arte de Sao Paulo",
        "city": "Sao Paulo",
        "country": "Brazil",
        "start_date": "2026-03-01",
        "end_date": "2026-07-31",
        "description": "An immersive journey through Vincent van Gogh's most celebrated works, "
                       "exploring his brushwork, color theory, and emotional intensity.",
        "movement_tags": '["Post-Impressionism"]',
        "artist_tags": '["Vincent van Gogh"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Dali: The Endless Enigma",
        "venue_name": "Pinacoteca do Estado",
        "city": "Sao Paulo",
        "country": "Brazil",
        "start_date": "2026-04-10",
        "end_date": "2026-08-30",
        "description": "Major retrospective of Salvador Dali's Surrealist masterpieces and "
                       "lesser-known experimental works.",
        "movement_tags": '["Surrealism"]',
        "artist_tags": '["Salvador Dali"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Impressionism: The Essential Masterpieces",
        "venue_name": "National Gallery",
        "city": "London",
        "country": "United Kingdom",
        "start_date": "2026-02-15",
        "end_date": "2026-06-15",
        "description": "Monet, Renoir, Degas and their revolution of light and perception. "
                       "Over 80 works rarely seen outside French collections.",
        "movement_tags": '["Impressionism"]',
        "artist_tags": '["Claude Monet", "Pierre-Auguste Renoir", "Edgar Degas"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Picasso and the Spanish Avant-Garde",
        "venue_name": "Tate Modern",
        "city": "London",
        "country": "United Kingdom",
        "start_date": "2026-05-01",
        "end_date": "2026-09-30",
        "description": "Tracing the radical innovations of Picasso and his contemporaries "
                       "across Cubism, Surrealism, and beyond.",
        "movement_tags": '["Cubism", "Surrealism"]',
        "artist_tags": '["Pablo Picasso", "Joan Miro"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Vermeer: The Rijksmuseum Collection",
        "venue_name": "Rijksmuseum",
        "city": "Amsterdam",
        "country": "Netherlands",
        "start_date": "2026-01-20",
        "end_date": "2026-12-31",
        "description": "The world's largest institutional collection of Vermeer — "
                       "intimate scenes of domestic life rendered with transcendent light.",
        "movement_tags": '["Dutch Golden Age"]',
        "artist_tags": '["Johannes Vermeer"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Rembrandt: Light and Shadow",
        "venue_name": "Van Gogh Museum",
        "city": "Amsterdam",
        "country": "Netherlands",
        "start_date": "2026-03-15",
        "end_date": "2026-08-15",
        "description": "Examining Rembrandt's revolutionary use of chiaroscuro "
                       "across five decades of portraiture and biblical scenes.",
        "movement_tags": '["Dutch Golden Age", "Baroque"]',
        "artist_tags": '["Rembrandt van Rijn"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Monet's Garden at Giverny",
        "venue_name": "Musee de l'Orangerie",
        "city": "Paris",
        "country": "France",
        "start_date": "2026-04-01",
        "end_date": "2026-10-31",
        "description": "The complete Water Lilies cycle displayed in the oval galleries "
                       "Monet himself designed for these works.",
        "movement_tags": '["Impressionism"]',
        "artist_tags": '["Claude Monet"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Frida Kahlo: Self-Portraits",
        "venue_name": "Centre Pompidou",
        "city": "Paris",
        "country": "France",
        "start_date": "2026-06-01",
        "end_date": "2026-11-30",
        "description": "The most comprehensive European survey of Kahlo's intimate "
                       "self-examination — pain, identity, and Mexican heritage.",
        "movement_tags": '["Surrealism", "Mexican Muralism"]',
        "artist_tags": '["Frida Kahlo"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Abstract Expressionism: New York School",
        "venue_name": "Museum of Modern Art",
        "city": "New York",
        "country": "United States",
        "start_date": "2026-03-01",
        "end_date": "2026-09-01",
        "description": "Pollock, Rothko, de Kooning and the movement that redefined "
                       "Western art after World War II.",
        "movement_tags": '["Abstract Expressionism"]',
        "artist_tags": '["Jackson Pollock", "Mark Rothko", "Willem de Kooning"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Warhol: The American Dream",
        "venue_name": "The Metropolitan Museum of Art",
        "city": "New York",
        "country": "United States",
        "start_date": "2026-05-15",
        "end_date": "2026-10-15",
        "description": "Pop Art's defining voice on celebrity, commerce, and "
                       "mass culture — from Campbell's Soup to Marilyn.",
        "movement_tags": '["Pop Art"]',
        "artist_tags": '["Andy Warhol"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Baroque: Power and Devotion",
        "venue_name": "Alte Pinakothek",
        "city": "Munich",
        "country": "Germany",
        "start_date": "2026-02-01",
        "end_date": "2026-07-01",
        "description": "Rubens, Caravaggio and the drama of the Counter-Reformation — "
                       "grandeur, passion, and divine light.",
        "movement_tags": '["Baroque"]',
        "artist_tags": '["Peter Paul Rubens", "Caravaggio"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
    {
        "title": "Renaissance Masters: Florence and Rome",
        "venue_name": "Uffizi Gallery",
        "city": "Florence",
        "country": "Italy",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "description": "Botticelli, Leonardo, Michelangelo and the flowering of "
                       "humanism in 15th and 16th century Italy.",
        "movement_tags": '["Renaissance"]',
        "artist_tags": '["Sandro Botticelli", "Leonardo da Vinci", "Michelangelo"]',
        "source": "seed",
        "taste_affinity": 0.0,
    },
]


def get_exhibition_seed():
    return EXHIBITION_SEED
