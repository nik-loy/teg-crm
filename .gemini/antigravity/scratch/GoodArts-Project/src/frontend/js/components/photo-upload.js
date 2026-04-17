/**
 * GoodArts — Photo Upload / Quick Capture Component
 */
window.PhotoUpload = {
    openCapture() {
        var body = document.getElementById("capture-body");
        if (!body) return;
        body.innerHTML =
            "<h2 class="italic-heading mb-2">Quick Capture</h2>" +
            "<div style="display:flex; flex-direction:column; gap: 1rem;">" +
                "<label class="file-label">" +
                    "<input type="file" id="capture-file" accept="image/*" capture="environment" style="display:none;" onchange="window.PhotoUpload.onFileSelected(this)">" +
                    "<div class="btn btn-messy" style="text-align:center; cursor:pointer;">Take Photo or Choose File</div>" +
                "</label>" +
                "<div id="capture-preview" style="display:none;">" +
                    "<img id="capture-preview-img" style="max-width:100%; max-height:300px; border-radius: 4px;">" +
                "</div>" +
                "<select id="capture-mode" class="search-input">" +
                    "<option value="artwork">Attach to artwork</option>" +
                    "<option value="visit">Add to visit log</option>" +
                    "<option value="new">Create new artwork</option>" +
                "</select>" +
                "<input type="text" id="capture-search" class="search-input" placeholder="Search artwork to attach to...">" +
                "<input type="text" id="capture-caption" class="search-input" placeholder="Caption or note (optional)">" +
                "<button class="btn btn-messy" onclick="window.PhotoUpload.submit()">Upload</button>" +
            "</div>";
        document.getElementById("capture-modal").classList.remove("hidden");
    },

    onFileSelected(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var preview = document.getElementById("capture-preview");
                var img = document.getElementById("capture-preview-img");
                if (preview && img) {
                    img.src = e.target.result;
                    preview.style.display = "block";
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    async submit() {
        var fileInput = document.getElementById("capture-file");
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            alert("Please select a photo first.");
            return;
        }

        var caption = document.getElementById("capture-caption").value.trim();
        var formData = new FormData();
        formData.append("file", fileInput.files[0]);
        if (caption) formData.append("caption", caption);

        try {
            var result = await window.API.uploadFile("/photos/upload", formData);
            document.getElementById("capture-modal").classList.add("hidden");
            alert("Photo uploaded!");
        } catch (e) {
            alert("Upload failed.");
        }
    }
};
