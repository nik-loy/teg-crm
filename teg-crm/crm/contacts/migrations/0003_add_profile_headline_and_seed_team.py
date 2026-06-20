# Generated manually on 2026-06-20

import django.db.models.deletion
from django.db import migrations, models

def seed_team_members(apps, schema_editor):
    TeamMember = apps.get_model('contacts', 'TeamMember')
    team_names = ["Jonas Böhrer", "Abdul Aljubahji", "Markus Ramsauer", "Niklas Loycke"]
    for name in team_names:
        TeamMember.objects.get_or_create(name=name)

class Migration(migrations.Migration):

    dependencies = [
        ('contacts', '0002_contact_event'),
    ]

    operations = [
        migrations.AddField(
            model_name='contact',
            name='profile_headline',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RunPython(seed_team_members),
    ]
