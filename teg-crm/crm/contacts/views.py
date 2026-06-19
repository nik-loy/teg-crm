from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Event, Contact, TeamMember, RawProfileData, Rating
from .serializers import EventSerializer, ContactSerializer, TeamMemberSerializer
import threading

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
    
    cfg = Config.from_env()
    if not cfg.gemini_api_key:
        return

    try:
        contact = Contact.objects.get(id=contact_id)
        event = Event.objects.first()
        if not event or not event.fit_scoring_prompt:
            return

        from google import genai
        from pydantic import BaseModel
        
        class FitScore(BaseModel):
            score: int
            reason: str

        ai_client = genai.Client(api_key=cfg.gemini_api_key)
        
        raw_data = getattr(contact, "raw_profile_data", None)
        profile_text = raw_data.raw_text if raw_data else ""
        
        profile_details = f"Name: {contact.name}\nRaw Profile:\n{profile_text}"
        
        system_instruction = event.fit_scoring_prompt + "\n\nYou must provide a score between 1 and 5, and a short reason (maximum 2 sentences) explaining why you assigned this score."

        response = ai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=profile_details,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=FitScore,
                max_output_tokens=150,
            ),
        )
        
        raw = response.text or ""
        cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned, strict=False)
        
        Rating.objects.update_or_create(
            contact=contact,
            defaults={
                "score": result.get("score", 0),
                "reason": result.get("reason", "")
            }
        )
    except Exception as e:
        print(f"Rating generation failed: {e}")

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
        
        if username == "TEG" and password == "TEGmoney":
            from django.contrib.auth.models import User
            user, _ = User.objects.get_or_create(username="TEG")
            refresh = RefreshToken.for_user(user)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            })
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer


class TeamMemberViewSet(viewsets.ModelViewSet):
    queryset = TeamMember.objects.all()
    serializer_class = TeamMemberSerializer


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

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

    @action(detail=False, methods=["post"])
    def enrich(self, request):
        raw_text = request.data.get("raw_text")
        if not raw_text:
            return Response({"error": "raw_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        lines = raw_text.strip().split("\n")
        if not lines:
            return Response({"error": "Invalid raw_text format"}, status=status.HTTP_400_BAD_REQUEST)
        
        exact_name = lines[0].strip()
        
        contact = Contact.objects.filter(name=exact_name).first()
        if not contact:
            return Response({"error": f"Contact with name '{exact_name}' not found."}, status=status.HTTP_400_BAD_REQUEST)
        
        RawProfileData.objects.update_or_create(
            contact=contact,
            defaults={"raw_text": raw_text}
        )

        threading.Thread(target=generate_rating_task, args=(contact.id,)).start()

        return Response({"status": "Profile enriched and rating generation started"})

    @action(detail=True, methods=["post"])
    def generate_message(self, request, pk=None):
        contact = self.get_object()
        
        from src.config import Config
        cfg = Config.from_env()
        if not cfg.gemini_api_key:
            return Response({"error": "No GEMINI_API_KEY configured"}, status=status.HTTP_501_NOT_IMPLEMENTED)
            
        try:
            event = Event.objects.first()
            if not event:
                return Response({"error": "No active event found"}, status=status.HTTP_400_BAD_REQUEST)

            from google import genai
            import json
            ai_client = genai.Client(api_key=cfg.gemini_api_key)

            prompt = event.outreach_prompt
            raw_data = getattr(contact, "raw_profile_data", None)
            profile_text = raw_data.raw_text if raw_data else ""
            
            rating_obj = getattr(contact, "rating", None)
            rating_str = ""
            if rating_obj:
                rating_str = f"Rating: {rating_obj.score}/5. Reason: {rating_obj.reason}\n"

            contact_details = f"Name: {contact.name}\n{rating_str}Profile Information:\n{profile_text}"
            
            system_instruction = f"""You are an expert sales representative. Generate 3 distinct personalized outreach messages.
Each outreach message variation MUST be concise (under 400 characters) and direct.
Event details/prompt: {prompt}
Contact details:
{contact_details}

Return EXACTLY 3 variations in a JSON array of strings."""

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
            
            contact.follow_up_complete = True
            contact.save(update_fields=["follow_up_complete"])
            
            formatted_variants = [{"angle": f"Variant {i+1}", "text": text} for i, text in enumerate(variations)]
            
            return Response({
                "variants": formatted_variants
            })
        except Exception as e:
            return Response({"error": f"Failed to generate messages: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_queryset(self):
        queryset = Contact.objects.all()
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(name__icontains=q)

        exact_name = self.request.query_params.get("name")
        if exact_name:
            queryset = queryset.filter(name=exact_name)
            
        return queryset
