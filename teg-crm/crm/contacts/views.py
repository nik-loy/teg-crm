from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Event, Contact, TeamMember, RawProfileData, Rating, SavedMessage
from .serializers import EventSerializer, ContactSerializer, TeamMemberSerializer
import threading
import logging

logger = logging.getLogger(__name__)

# ==========================================
# INPUT VALIDATION SERIALIZERS
# ==========================================

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True, allow_blank=False)
    password = serializers.CharField(required=True, allow_blank=False)


class LeadImportSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

# ==========================================
# BACKGROUND TASKS
# ==========================================

def generate_rating_task(contact_id):
    from src.config import Config
    import json
    
    logger.info("Starting generate_rating_task for contact_id=%s", contact_id)
    
    try:
        cfg = Config.from_env()
        if not cfg.gemini_api_key:
            logger.error("GEMINI_API_KEY is not configured.")
            raise ValueError("GEMINI_API_KEY is not configured.")

        contact = Contact.objects.get(id=contact_id)
        event = Event.objects.first()
        if not event or not event.fit_scoring_prompt:
            logger.error("No active event or fit_scoring_prompt configured.")
            raise ValueError("No active event or fit_scoring_prompt configured.")

        from google import genai
        from pydantic import BaseModel
        
        class FitScore(BaseModel):
            score: int
            reason: str

        ai_client = genai.Client(api_key=cfg.gemini_api_key)
        
        raw_data = getattr(contact, "raw_profile_data", None)
        if not raw_data or not raw_data.raw_text:
            logger.error("No raw profile data found for contact_id=%s.", contact_id)
            raise ValueError("No raw profile data found for this contact.")
        
        profile_text = raw_data.raw_text
        
        profile_details = f"Name: {contact.name}\nHeadline: {contact.profile_headline or ''}\nLinkedIn: {contact.linkedin_url or ''}\nRaw Profile:\n{profile_text}"
        
        system_instruction = event.fit_scoring_prompt + "\n\nYou must provide a score between 1 and 5, and a short reason (maximum 2 sentences) explaining why you assigned this score."

        logger.info("Calling Gemini API to rate contact '%s' (ID: %s)...", contact.name, contact.id)
        response = ai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=profile_details,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=FitScore,
                max_output_tokens=500,
            ),
        )
        
        logger.info("Received rating response from Gemini API.")
        raw = response.text or ""
        cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned, strict=False)
        
        score = result.get("score", 0)
        reason = result.get("reason", "")
        
        Rating.objects.update_or_create(
            contact=contact,
            defaults={
                "score": score,
                "reason": reason
            }
        )
        logger.info("Saved rating for contact '%s' (ID: %s): score=%s, reason='%s'", contact.name, contact.id, score, reason)
    except Exception as e:
        logger.exception("Error in generate_rating_task for contact_id=%s", contact_id)
        raise e

# ==========================================
# VIEWS AND VIEWSETS
# ==========================================

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]
        
        logger.info("Login attempt for username: '%s'", username)
        
        if username == "TEG" and password == "TEGmoney":
            from django.contrib.auth.models import User
            user, _ = User.objects.get_or_create(username="TEG")
            refresh = RefreshToken.for_user(user)
            logger.info("User '%s' logged in successfully.", username)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            })
        logger.warning("Invalid credentials login attempt for username: '%s'", username)
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    @action(detail=True, methods=["get"])
    def attendances(self, request, pk=None):
        event = self.get_object()
        contacts = event.contacts.all().select_related("rating")
        
        results = []
        for c in contacts:
            score = c.rating.score if hasattr(c, "rating") and c.rating else None
            reason = c.rating.reason if hasattr(c, "rating") and c.rating else ""
            
            results.append({
                "id": c.id,  # Using contact ID as attendance ID for now to make UI happy
                "fit_score": score,
                "fit_reason": reason,
                "contact": {
                    "id": c.id,
                    "name": c.name,
                    "linkedin_url": c.linkedin_url
                }
            })
            
        return Response(results)


class TeamMemberViewSet(viewsets.ModelViewSet):
    queryset = TeamMember.objects.all()
    serializer_class = TeamMemberSerializer


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    def perform_create(self, serializer):
        contact = serializer.save()
        logger.info(
            "Created contact '%s' (ID: %s, Headline: '%s', Event: %s, Owner: %s)",
            contact.name,
            contact.id,
            contact.profile_headline or "",
            contact.event.name if contact.event else "None",
            contact.follow_up_owner.name if contact.follow_up_owner else "None",
        )

    def perform_update(self, serializer):
        contact = serializer.save()
        logger.info(
            "Updated contact '%s' (ID: %s, Stage: %s, Complete: %s)",
            contact.name,
            contact.id,
            getattr(contact, "pipeline_stage", "N/A"),
            contact.follow_up_complete,
        )

    @action(detail=False, methods=["get"])
    def stats(self, request):
        total = Contact.objects.count()
        return Response({
            "total": total,
            "byStage": {"Activated": total},
            "byTier": {},
            "bySource": {},
            "byStatus": {},
            "newByMonth": {}
        })

    @action(detail=False, methods=["get"])
    def export(self, request):
        import openpyxl
        from django.http import HttpResponse

        logger.info("Export leads requested.")

        wb = openpyxl.Workbook()
        
        # Sheet 1: Events
        ws_events = wb.active
        ws_events.title = "Events"
        ws_events.append(["ID", "Name", "Date", "Luma URL"])
        
        events = Event.objects.all()
        for event in events:
            ws_events.append([
                event.id,
                event.name,
                str(event.date) if event.date else "",
                event.luma_url or ""
            ])

        # Sheet 2: Contacts
        ws_contacts = wb.create_sheet(title="Contacts")
        ws_contacts.append([
            "Name",
            "LinkedIn URL",
            "Profile Headline",
            "Event Name",
            "Team Member Name",
            "Follow Up Complete",
            "Raw Data Text",
            "Score",
            "Reason for scoring",
            "Message Text"
        ])

        contacts = Contact.objects.select_related(
            "event", "follow_up_owner", "raw_profile_data", "rating"
        ).prefetch_related("saved_messages").all()

        for contact in contacts:
            raw_text = contact.raw_profile_data.raw_text if hasattr(contact, "raw_profile_data") and contact.raw_profile_data else ""
            score = contact.rating.score if hasattr(contact, "rating") and contact.rating else ""
            reason = contact.rating.reason if hasattr(contact, "rating") and contact.rating else ""
            
            # Get latest saved message if exists
            last_message_obj = contact.saved_messages.last()
            message_text = last_message_obj.message_text if last_message_obj else ""

            ws_contacts.append([
                contact.name,
                contact.linkedin_url or "",
                contact.profile_headline or "",
                contact.event.name if contact.event else "",
                contact.follow_up_owner.name if contact.follow_up_owner else "",
                "Yes" if contact.follow_up_complete else "No",
                raw_text,
                score,
                reason,
                message_text
            ])

        response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = 'attachment; filename="leads_export.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=["post"])
    def enrich(self, request):
        raw_text = request.data.get("raw_text")
        if not raw_text:
            return Response({"error": "raw_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        lines = raw_text.strip().split("\n")
        if not lines:
            return Response({"error": "Invalid raw_text format"}, status=status.HTTP_400_BAD_REQUEST)
        
        exact_name = lines[0].strip()
        logger.info("Enrichment requested for contact name: '%s'", exact_name)
        
        contact = Contact.objects.filter(name=exact_name).first()
        if not contact:
            logger.warning("Contact with name '%s' not found for enrichment.", exact_name)
            return Response({"error": f"Contact with name '{exact_name}' not found."}, status=status.HTTP_400_BAD_REQUEST)
        
        RawProfileData.objects.update_or_create(
            contact=contact,
            defaults={"raw_text": raw_text}
        )
        logger.info("Saved/updated raw profile data for contact '%s' (ID: %s).", contact.name, contact.id)

        try:
            generate_rating_task(contact.id)
            logger.info("Profile enrichment and rating generation succeeded for contact '%s' (ID: %s).", contact.name, contact.id)
            return Response({"status": "Profile enriched and rating generated"})
        except Exception as e:
            logger.error("Failed to generate rating during enrichment of contact '%s' (ID: %s): %s", contact.name, contact.id, str(e))
            return Response({"error": f"Failed to generate rating: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def generate_message(self, request, pk=None):
        contact = self.get_object()
        logger.info("Message generation requested for contact '%s' (ID: %s)", contact.name, contact.id)
        
        from src.config import Config
        cfg = Config.from_env()
        if not cfg.gemini_api_key:
            logger.error("No GEMINI_API_KEY configured for message generation.")
            return Response({"error": "No GEMINI_API_KEY configured"}, status=status.HTTP_501_NOT_IMPLEMENTED)
            
        try:
            event = Event.objects.first()
            if not event:
                logger.error("No active event found for message generation.")
                return Response({"error": "No active event found"}, status=status.HTTP_400_BAD_REQUEST)

            from google import genai
            import json
            ai_client = genai.Client(api_key=cfg.gemini_api_key)

            prompt = event.outreach_prompt
            raw_data = getattr(contact, "raw_profile_data", None)
            profile_text = raw_data.raw_text if raw_data else ""
            
            rating_obj = getattr(contact, "rating", None)
            rating_str = ""
            fit_score = None
            if rating_obj:
                rating_str = f"Rating: {rating_obj.score}/5. Reason: {rating_obj.reason}\n"
                fit_score = rating_obj.score

            contact_details = f"Name: {contact.name}\n{rating_str}Profile Information:\n{profile_text}"
            
            system_instruction = f"""You are an expert sales representative. Generate 3 distinct personalized outreach messages.
Each outreach message variation MUST be concise (under 500 characters) and direct.
Event details/prompt: {prompt}
Contact details:
{contact_details}

Return EXACTLY 3 variations in a JSON array of strings."""

            logger.info("Calling Gemini API to generate outreach message variants for contact '%s' (ID: %s)...", contact.name, contact.id)
            response = ai_client.models.generate_content(
                model="gemini-2.5-flash",
                contents="Generate messages now.",
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                ),
            )
            
            raw = response.text or ""
            cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
            variations = json.loads(cleaned, strict=False)
            logger.info("Received message variations from Gemini API. Parsing succeeded.")
            
            contact.follow_up_complete = True
            contact.save(update_fields=["follow_up_complete"])
            logger.info("Marked follow-up complete for contact '%s' (ID: %s).", contact.name, contact.id)
            
            formatted_variants = [{"angle": f"Variant {i+1}", "text": text} for i, text in enumerate(variations)]
            logger.info("Successfully generated %d outreach message variants for contact '%s'.", len(variations), contact.name)
            
            return Response({
                "variants": formatted_variants,
                "fit": fit_score
            })
        except Exception as e:
            logger.exception("Failed to generate messages for contact '%s' (ID: %s)", contact.name, contact.id)
            return Response({"error": f"Failed to generate messages: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def save_message(self, request, pk=None):
        contact = self.get_object()
        message_text = request.data.get("message_text")
        
        if not message_text:
            logger.warning("save_message failed: message_text is empty or not provided for contact_id=%s.", contact.id)
            return Response({"error": "message_text is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        logger.info("Saving selected message for contact '%s' (ID: %s). Message length: %d chars.", contact.name, contact.id, len(message_text))
        from .models import SavedMessage
        saved_msg = SavedMessage.objects.create(
            contact=contact,
            message_text=message_text
        )
        logger.info("Successfully saved message (ID: %s) for contact '%s'.", saved_msg.id, contact.name)
        
        return Response({
            "status": "success",
            "message": "Message saved successfully",
            "id": saved_msg.id
        })

    def get_queryset(self):
        queryset = Contact.objects.all()
        queryset = self._filter_by_search_query(queryset)
        queryset = self._filter_by_exact_name(queryset)
        queryset = self._filter_by_owner(queryset)
        return queryset

    def _filter_by_search_query(self, queryset):
        """Filters contacts by name search query parameter 'q' (case-insensitive)."""
        q = self.request.query_params.get("q")
        if q:
            return queryset.filter(name__icontains=q)
        return queryset

    def _filter_by_exact_name(self, queryset):
        """Filters contacts by exact name match parameter 'name' (case-sensitive)."""
        exact_name = self.request.query_params.get("name")
        if exact_name:
            return queryset.filter(name=exact_name)
        return queryset

    def _filter_by_owner(self, queryset):
        """Filters contacts by follow-up owner name parameter 'owner' (case-insensitive)."""
        owner = self.request.query_params.get("owner")
        if owner:
            return queryset.filter(follow_up_owner__name__icontains=owner)
        return queryset

