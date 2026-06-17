from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Event, Contact, Attendance, OutreachDraft
from .serializers import EventSerializer, AttendanceSerializer, OutreachDraftSerializer, ContactSerializer

# ==========================================
# INPUT VALIDATION SERIALIZERS
# ==========================================

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True, allow_blank=False)
    password = serializers.CharField(required=True, allow_blank=False)


class LeadImportSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

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
            # Ensure the user exists for JWT generation
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
    lookup_field = "slug"

    @action(detail=True, methods=["post"])
    def import_leads(self, request, slug=None):
        event = self.get_object()
        
        serializer = LeadImportSerializer(data=request.FILES)
        serializer.is_valid(raise_exception=True)
        
        file_obj = serializer.validated_data["file"]
        
        from src.importer.excel_csv_importer import import_excel_or_csv
        count = import_excel_or_csv(file_obj, file_obj.name, event)
        return Response({"status": "Import successful", "event": event.slug, "count": count})

    @action(detail=True, methods=["get"])
    def attendances(self, request, slug=None):
        event = self.get_object()
        # Order by fit_score descending (None values last)
        attendances = event.attendances.all().order_by("-fit_score")
        serializer = AttendanceSerializer(attendances, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def drafts(self, request, slug=None):
        event = self.get_object()
        drafts = OutreachDraft.objects.filter(attendance__event=event).order_by("-created_at")
        serializer = OutreachDraftSerializer(drafts, many=True)
        return Response(serializer.data)


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer

    @action(detail=True, methods=["post"])
    def generate_message(self, request, pk=None):
        attendance = self.get_object()
        # Mocking generation for now
        draft, _ = OutreachDraft.objects.get_or_create(
            attendance=attendance,
            step_number=1,
            defaults={
                "generated_text": f"Mock generated text for {attendance.contact.name} at {attendance.event.name}",
                "status": OutreachDraft.Status.PENDING,
            }
        )
        return Response(OutreachDraftSerializer(draft).data)


class OutreachDraftViewSet(viewsets.ModelViewSet):
    queryset = OutreachDraft.objects.all()
    serializer_class = OutreachDraftSerializer


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    @action(detail=False, methods=["post"])
    def extract_profile(self, request):
        profile_text = request.data.get("profileText", "")
        if not profile_text:
            return Response({"error": "profileText is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        from src.config import Config
        cfg = Config.from_env()
        if not cfg.gemini_api_key:
            return Response({"error": "No GEMINI_API_KEY configured on backend"}, status=status.HTTP_501_NOT_IMPLEMENTED)
        
        try:
            from google import genai
            import json
        except ImportError:
            return Response({"error": "google-genai package not installed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        system_instruction = """You convert a messy, copy-pasted LinkedIn profile into strict JSON.

RULES:
- Return ONLY a JSON object, no markdown, no commentary.
- AUTHORED vs REPOSTED: the feed mixes the person's own posts with REPOSTS/SHARES of
  others' content. Lines like "<Name> reposted this", "Sponsored", "View company:", or a
  different author byline mark REPOSTED content. Put ONLY content the person AUTHORED into
  authored_posts and personalization_signals. NEVER include reposted/shared content
  (e.g. political memes, other companies' posts) — count them in excluded_reposts_count.
- DO NOT invent or hallucinate. If a field (e.g. About) is absent, return "" or [].
- LOSSLESS: every meaningful piece of AUTHORED profile information must land in SOME
  field. If a relevant detail (languages, certifications, awards, volunteering,
  publications, projects) fits no dedicated field, put it in other_notes verbatim. Do not
  silently drop authored information.

NAME:
- name = the person's name at the TOP of the profile (first line), NOT a post author.

EXPERIENCE (CRUCIAL — capture COMPLETELY):
- Include EVERY role listed under Experience — current AND all past roles. Never summarise
  or omit older positions. Each entry: {title, company, dates, current}. dates verbatim
  (e.g. "Jan 2024 – Present"). current:true only for present roles.
- current_company = the first company in the headline (or the current role's company).

EDUCATION (CRUCIAL — capture COMPLETELY):
- Include EVERY school/university listed under Education, in order. Each entry:
  {school, degree, years}. Keep degrees and years verbatim. Do not drop secondary
  schooling (e.g. Abitur) if listed.

OTHER FIELDS:
- The canonical headline is the one at the TOP of the profile (under the name), not a
  post byline. location = the line under the headline (e.g. "Munich, Bavaria, Germany").
- Strip noise: "Message", "More", "Connect", "Follow", "Endorse",
  "Show translation", "… more", "View image", "1/3", reaction/comment/repost counts,
  "N followers", "N connections", hashtags, emojis.
- personalization_signals = short topical phrases from AUTHORED posts + role/industry
  (e.g. "Gemini Enterprise", "Agentic AI"). German or English as written.

CONNECTION DEGREE:
- connection_degree = "1st" if "· 1st" appears near the person's name, "2nd" if "· 2nd",
  "3rd" if "· 3rd". Default "unknown" if not found.

MUTUAL CONNECTIONS:
- mutual_connections = names from ONLY "[Name] is a mutual connection" lines.
- EXCLUDE "Followed by [Name]" lines in the "People who follow X also follow" section —
  those describe followers of other people, not direct mutual connections.
- Return [] if no mutual connection lines are present.

OPEN TO WORK:
- open_to_work = true if the text "open to work" or "Open to Work" appears on the profile
  (typically as a banner or under the name). Otherwise false.

LANGUAGES:
- From the Languages section: each entry as {name, proficiency}. E.g.
  {name: "English", proficiency: "Full professional proficiency"}.
  Return [] if no Languages section is present.

ORGANIZATIONS:
- From the Organizations section and any listed volunteer roles under Experience: each
  entry as {name, role, dates}. Include professional memberships AND volunteer positions.
  Return [] if none found.

CERTIFICATIONS:
- From the Licenses & certifications section. List up to 7 most relevant professional
  credentials. Prioritise industry/professional certs (PMP, CFA, CISA, etc.) over
  LinkedIn Learning completions. Return just the certification name as a string.
  Return [] if none found.

WEBSITE:
- website = the first personal or company URL found in About text, Contact Info, or
  featured links. Common patterns: "www.", "http://", standalone domain. Return "" if
  none found.

KEY ACHIEVEMENTS:
- key_achievements = up to 5 specific, quantified facts from the About section.
  E.g. "25 years of experience", "more than 30 organisations", "PMI PMP certified".
  Only concrete numbers or notable credentials — not generic statements like "proven
  track record". Return [] if nothing concrete is present.

Output JSON shape:
{"name","headline","current_title","current_company","location","industry",
 "seniority_estimate","education":[{"school","degree","years"}],
 "experience":[{"title","company","dates","current"}],"skills":[],
 "authored_posts":[{"summary","topics":[]}],"personalization_signals":[],
 "about","other_notes":[],"excluded_reposts_count",
 "connection_degree","mutual_connections":[],"open_to_work",
 "languages":[{"name","proficiency"}],"organizations":[{"name","role","dates"}],
 "certifications":[],"website","key_achievements":[]}"""

        try:
            ai_client = genai.Client(api_key=cfg.gemini_api_key)
            response = ai_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=profile_text.strip(),
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    max_output_tokens=2048,
                ),
            )
            raw = response.text or ""
            cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned)
            return Response(result)
        except Exception as e:
            return Response({"error": f"Failed to extract profile: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_queryset(self):
        queryset = Contact.objects.all().prefetch_related("attendances__event")
        
        stage = self.request.query_params.get("stage")
        if stage:
            queryset = queryset.filter(pipeline_stage=stage)
            
        tier = self.request.query_params.get("tier")
        if tier:
            queryset = queryset.filter(tier=tier)
            
        owner = self.request.query_params.get("owner")
        if owner:
            queryset = queryset.filter(outreach_owner__icontains=owner)
            
        event_name = self.request.query_params.get("event")
        if event_name:
            queryset = queryset.filter(attendances__event__name__icontains=event_name)
            
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(name__icontains=q)

        linkedin_url = self.request.query_params.get("linkedin_url")
        if linkedin_url:
            queryset = queryset.filter(linkedin_url=linkedin_url)

        exact_name = self.request.query_params.get("name")
        if exact_name:
            queryset = queryset.filter(name=exact_name)
            
        return queryset

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.db.models import Count
        from django.db.models.functions import TruncMonth
        
        contacts = Contact.objects.all()
        total = contacts.count()
        
        by_stage = {item["pipeline_stage"]: item["count"] for item in contacts.values("pipeline_stage").annotate(count=Count("id"))}
        by_tier = {item["tier"]: item["count"] for item in contacts.values("tier").annotate(count=Count("id"))}
        by_source = {item["source"]: item["count"] for item in contacts.values("source").annotate(count=Count("id"))}
        by_status = {item["outreach_status"]: item["count"] for item in contacts.values("outreach_status").annotate(count=Count("id")) if item["outreach_status"]}
        
        new_by_month = {}
        for item in contacts.annotate(month=TruncMonth("created_at")).values("month").annotate(count=Count("id")).order_by("month"):
            if item["month"]:
                month_str = item["month"].strftime("%Y-%m")
                new_by_month[month_str] = item["count"]
                
        return Response({
            "total": total,
            "byStage": by_stage,
            "byTier": by_tier,
            "bySource": by_source,
            "byStatus": by_status,
            "newByMonth": new_by_month,
        })
