from django.db import models


class TeamMember(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Event(models.Model):
    name = models.CharField(max_length=255)
    date = models.DateField(null=True, blank=True)
    luma_url = models.URLField(blank=True, null=True)
    outreach_prompt = models.TextField(blank=True, help_text="Event-specific base prompt template for message generation.")
    fit_scoring_prompt = models.TextField(blank=True, help_text="Prompt defining the criteria for scoring leads 1-5.")

    def __str__(self):
        return self.name


class Contact(models.Model):
    name = models.CharField(max_length=255)
    linkedin_url = models.URLField(unique=True, blank=True, null=True)
    follow_up_owner = models.ForeignKey(
        TeamMember, on_delete=models.SET_NULL, null=True, blank=True, related_name="contacts"
    )
    follow_up_complete = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class RawProfileData(models.Model):
    contact = models.OneToOneField(Contact, on_delete=models.CASCADE, related_name="raw_profile_data")
    raw_text = models.TextField()

    def __str__(self):
        return f"Raw Data for {self.contact.name}"


class Rating(models.Model):
    contact = models.OneToOneField(Contact, on_delete=models.CASCADE, related_name="rating")
    score = models.IntegerField()
    reason = models.TextField()

    def __str__(self):
        return f"Rating: {self.score} for {self.contact.name}"

