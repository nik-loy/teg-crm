"""GoodArts — Curated Fun Facts for Canonical Artworks. Keyed by Wikidata ID."""

FUN_FACTS: dict = {
    "Q12418": [
        "The Mona Lisa was stolen from the Louvre in 1911 by Vincenzo Peruggia, who hid in a closet overnight. It was missing for over two years.",
        "Leonardo worked on the painting for at least four years and may have never considered it finished. He carried it with him to France.",
        "The painting has no eyebrows — some historians believe Leonardo intended this, while others think they faded over time from cleaning.",
    ],
    "Q45585": [
        "Van Gogh painted The Starry Night while in the Saint-Paul-de-Mausole asylum. He considered it a failure.",
        "The swirling patterns match mathematical turbulence models — Kolmogorov's theory — with uncanny precision.",
        "The cypress tree in the foreground connects earth to sky, a motif borrowed from Japanese ukiyo-e prints he collected.",
    ],
    "Q130979": [
        "Picasso painted Guernica in just 35 days as a response to the bombing of the Basque town by Nazi German and Fascist Italian warplanes.",
        "When a Nazi officer asked Picasso 'Did you do that?', he reportedly replied 'No, you did.'",
        "The painting is 3.49m tall and 7.76m wide. It has never been sold.",
    ],
    "Q151679": [
        "The Birth of Venus was one of the first large-scale non-religious nude paintings since antiquity.",
        "The model is believed to be Simonetta Vespucci, who died of tuberculosis at 22.",
        "Botticelli asked to be buried at her feet in the Church of Ognissanti — and he was.",
    ],
    "Q217541": [
        "The painting was trimmed on all four sides in 1715 to fit between two doors in Amsterdam Town Hall.",
        "The title 'The Night Watch' is a misnomer — the scene takes place during the day. Dark varnish gave it a nocturnal appearance.",
        "In 1975, a man slashed the painting with a bread knife. In 1990, another sprayed it with acid.",
    ],
    "Q272942": [
        "There are actually four versions of The Scream. One sold for $119.9 million in 2012.",
        "The sky turned 'blood red' — likely caused by the 1883 Krakatoa eruption.",
        "The figure is not screaming — it is trying to block out a scream coming from nature itself.",
    ],
    "Q239014": [
        "Despite being Japan's most iconic artwork, The Great Wave was heavily influenced by Western perspective techniques from Dutch prints.",
        "Hokusai was approximately 70 years old when he created this print.",
        "Mount Fuji appears tiny — the real subject is the terrifying power of the sea.",
    ],
    "Q183399": [
        "Dalí claimed the melting watches were inspired by the sight of Camembert cheese melting in the sun.",
        "The entire painting is only 24cm × 33cm — about the size of a sheet of paper.",
        "The amorphous figure in the center is a self-portrait of Dalí's own face in profile.",
    ],
    "Q130531": [
        "Klimt used real gold leaf in the painting, applying Byzantine sacred art tradition to an explicitly sensual scene.",
        "The painting was purchased directly off the easel by the Austrian government before Klimt even finished it.",
    ],
    "Q127956": [
        "Monet painted approximately 250 water lily canvases over the last 30 years of his life.",
        "He had cataracts removed in 1923, which temporarily shifted his color perception.",
        "The lily pond at Giverny was an artificial creation — Monet diverted a river and planted the lilies himself.",
    ],
}


def get_fun_facts(wikidata_id: str) -> list:
    return FUN_FACTS.get(wikidata_id, [])
