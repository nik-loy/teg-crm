import json
from datetime import date
from datetime import datetime, timezone
import uuid
import pytest
from crm.contacts.models import Contact
from src.dashboard.generate_dashboard import aggregate, DashboardData, render_dashboard

pytestmark = pytest.mark.django_db


def _contact(
    stage="Awareness",
    tier="Tier 3",
    source="LinkedIn",
    fu_due=None,
    fu_complete=False,
    created=None,
) -> Contact:
    contact = Contact.objects.create(
        name="Test",
        linkedin_url=f"https://linkedin.com/in/{uuid.uuid4()}",
        pipeline_stage=stage,
        tier=tier,
        source=source,
        follow_up_due_date=fu_due,
        follow_up_complete=fu_complete,
    )
    if created:
        Contact.objects.filter(id=contact.id).update(created_at=created)
        contact.refresh_from_db()
    return contact


def test_aggregate_total_contacts():
    contacts = [_contact(), _contact(), _contact()]
    assert aggregate(contacts).total_contacts == 3


def test_aggregate_empty_returns_zeroes():
    data = aggregate([])
    assert data.total_contacts == 0
    assert data.overdue_count == 0
    assert data.by_stage == {}
    assert data.by_tier == {}
    assert data.by_source == {}
    assert data.new_by_month == {}


def test_aggregate_counts_by_stage():
    contacts = [_contact(stage="Awareness"), _contact(stage="Awareness"), _contact(stage="Engaged")]
    data = aggregate(contacts)
    assert data.by_stage["Awareness"] == 2
    assert data.by_stage["Engaged"] == 1


def test_aggregate_counts_by_tier():
    contacts = [_contact(tier="Tier 1"), _contact(tier="Tier 1"), _contact(tier="Tier 2")]
    data = aggregate(contacts)
    assert data.by_tier["Tier 1"] == 2
    assert data.by_tier["Tier 2"] == 1


def test_aggregate_counts_by_source():
    contacts = [_contact(source="Referral"), _contact(source="LinkedIn"), _contact(source="Referral")]
    data = aggregate(contacts)
    assert data.by_source["Referral"] == 2
    assert data.by_source["LinkedIn"] == 1


def test_aggregate_counts_overdue_followup():
    assert aggregate([_contact(fu_due=date(2020, 1, 1), fu_complete=False)]).overdue_count == 1


def test_aggregate_completed_followup_not_overdue():
    assert aggregate([_contact(fu_due=date(2020, 1, 1), fu_complete=True)]).overdue_count == 0


def test_aggregate_future_followup_not_overdue():
    assert aggregate([_contact(fu_due=date(2099, 12, 31), fu_complete=False)]).overdue_count == 0


def test_aggregate_no_due_date_not_overdue():
    assert aggregate([_contact(fu_complete=False)]).overdue_count == 0


def test_aggregate_multiple_overdue():
    contacts = [
        _contact(fu_due=date(2020, 1, 1), fu_complete=False),
        _contact(fu_due=date(2020, 6, 1), fu_complete=False),
        _contact(fu_due=date(2020, 1, 1), fu_complete=True),
        _contact(fu_due=date(2099, 12, 31), fu_complete=False),
    ]
    assert aggregate(contacts).overdue_count == 2


def test_aggregate_groups_by_month():
    contacts = [
        _contact(created=datetime(2026, 1, 10, 9, 0, tzinfo=timezone.utc)),
        _contact(created=datetime(2026, 1, 25, 9, 0, tzinfo=timezone.utc)),
        _contact(created=datetime(2026, 2, 3, 9, 0, tzinfo=timezone.utc)),
    ]
    data = aggregate(contacts)
    assert data.new_by_month["2026-01"] == 2
    assert data.new_by_month["2026-02"] == 1


def test_aggregate_generated_at_is_set():
    assert aggregate([]).generated_at != ""


def test_render_creates_output_file(tmp_path):
    template = tmp_path / "t.html"
    template.write_text('<script>const D={{DASHBOARD_DATA}};</script>')
    output = tmp_path / "out" / "index.html"
    render_dashboard(DashboardData(generated_at="x"), template, output)
    assert output.exists()


def test_render_replaces_placeholder(tmp_path):
    template = tmp_path / "t.html"
    template.write_text("DATA={{DASHBOARD_DATA}}")
    output = tmp_path / "out.html"
    render_dashboard(
        DashboardData(by_stage={"Awareness": 5}, total_contacts=5, generated_at="x"),
        template, output,
    )
    content = output.read_text()
    assert "{{DASHBOARD_DATA}}" not in content
    assert '"Awareness": 5' in content


def test_render_creates_parent_dirs(tmp_path):
    template = tmp_path / "t.html"
    template.write_text("{{DASHBOARD_DATA}}")
    deep_output = tmp_path / "a" / "b" / "index.html"
    render_dashboard(DashboardData(generated_at="x"), template, deep_output)
    assert deep_output.exists()


def test_render_new_by_month_is_sorted(tmp_path):
    template = tmp_path / "t.html"
    template.write_text("{{DASHBOARD_DATA}}")
    output = tmp_path / "o.html"
    data = DashboardData(
        new_by_month={"2026-03": 1, "2026-01": 2, "2026-02": 3},
        generated_at="x",
    )
    render_dashboard(data, template, output)
    parsed = json.loads(output.read_text())
    months = list(parsed["new_by_month"].keys())
    assert months == sorted(months)
