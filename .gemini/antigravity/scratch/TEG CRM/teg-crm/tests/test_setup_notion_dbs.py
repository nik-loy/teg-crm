from scripts.setup_notion_dbs import (
    build_companies_schema,
    build_events_schema,
    build_contacts_schema,
    build_events_attended_schema,
    build_interactions_schema,
    build_speaker_pipeline_schema,
)

PARENT = "page_123"
COMPANIES = "db_companies"
EVENTS = "db_events"
CONTACTS = "db_contacts"


def test_companies_schema_parent():
    schema = build_companies_schema(PARENT)
    assert schema["parent"] == {"type": "page_id", "page_id": PARENT}


def test_companies_schema_has_title_property():
    schema = build_companies_schema(PARENT)
    assert schema["properties"]["Company Name"] == {"title": {}}


def test_companies_schema_has_all_required_properties():
    props = build_companies_schema(PARENT)["properties"]
    assert "Industry" in props
    assert "Size" in props
    assert "Partnership Tier" in props
    assert "Seat Allocation Status" in props
    assert "Notes" in props


def test_companies_schema_size_options():
    props = build_companies_schema(PARENT)["properties"]
    names = [o["name"] for o in props["Size"]["select"]["options"]]
    assert names == ["Startup", "SME", "Mittelstand", "Corporate"]


def test_events_schema_has_format_options():
    props = build_events_schema(PARENT)["properties"]
    names = [o["name"] for o in props["Format"]["select"]["options"]]
    assert "Panel" in names
    assert "Fireside Chat" in names
    assert "Podcast" in names


def test_contacts_schema_company_relation():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    assert props["Company"]["relation"]["database_id"] == COMPANIES


def test_contacts_schema_pipeline_stage_options():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    names = [o["name"] for o in props["Pipeline Stage"]["select"]["options"]]
    assert names == ["Awareness", "First Attendance", "Engaged", "Deepening", "Activated"]


def test_contacts_schema_source_options():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    names = [o["name"] for o in props["Source"]["select"]["options"]]
    assert "TEG Event" in names
    assert "Company Partnership" in names


def test_contacts_schema_tags_options():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    names = [o["name"] for o in props["Tags"]["multi_select"]["options"]]
    assert "potential-speaker" in names
    assert "alumni-TUM" in names


def test_events_attended_relations():
    props = build_events_attended_schema(PARENT, CONTACTS, EVENTS)["properties"]
    assert props["Contact"]["relation"]["database_id"] == CONTACTS
    assert props["Event"]["relation"]["database_id"] == EVENTS


def test_interactions_contact_relation():
    props = build_interactions_schema(PARENT, CONTACTS)["properties"]
    assert props["Contact"]["relation"]["database_id"] == CONTACTS


def test_interactions_type_options():
    props = build_interactions_schema(PARENT, CONTACTS)["properties"]
    names = [o["name"] for o in props["Type"]["select"]["options"]]
    assert "LinkedIn Message" in names
    assert "In-Person" in names
    assert "Phone Call" in names


def test_speaker_pipeline_relations():
    props = build_speaker_pipeline_schema(PARENT, CONTACTS, EVENTS)["properties"]
    assert props["Contact"]["relation"]["database_id"] == CONTACTS
    assert props["Target Event"]["relation"]["database_id"] == EVENTS


def test_speaker_pipeline_stage_options():
    props = build_speaker_pipeline_schema(PARENT, CONTACTS, EVENTS)["properties"]
    names = [o["name"] for o in props["Stage"]["select"]["options"]]
    assert "Identified" in names
    assert "Post-Event" in names
    assert len(names) == 7
