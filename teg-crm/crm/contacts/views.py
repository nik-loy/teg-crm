from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Event, Contact, Attendance, OutreachDraft
from .serializers import EventSerializer, AttendanceSerializer, OutreachDraftSerializer

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        
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
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        
        from src.importer.apify_importer import import_apify_csv
        count = import_apify_csv(file_obj, event)
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
