from rest_framework import serializers
from .models import Event, Contact, TeamMember, RawProfileData, Rating

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = [
            "id", "name", "date", "luma_url", "outreach_prompt", "fit_scoring_prompt"
        ]
        read_only_fields = ["id"]


class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = ["id", "name"]


class RatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = ["score", "reason"]


class RawProfileDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawProfileData
        fields = ["raw_text"]


class ContactSerializer(serializers.ModelSerializer):
    follow_up_owner = TeamMemberSerializer(read_only=True)
    follow_up_owner_id = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.all(), source="follow_up_owner", write_only=True, required=False, allow_null=True
    )
    rating = RatingSerializer(read_only=True)
    event = EventSerializer(read_only=True)
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), source="event", write_only=True, required=False, allow_null=True
    )
    
    class Meta:
        model = Contact
        fields = [
            "id", "name", "linkedin_url", "follow_up_owner", "follow_up_owner_id",
            "follow_up_complete", "rating", "event", "event_id"
        ]
