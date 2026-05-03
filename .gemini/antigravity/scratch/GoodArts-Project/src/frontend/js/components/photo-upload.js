/**
 * GoodArts - Photo Upload / Quick Capture Component
 */
window.PhotoUpload = {
    openCapture() {
        var body = document.getElementById('capture-body');
        if (!body) return;
        body.textContent = '';

        var h2 = document.createElement('h2');
        h2.className = 'italic-heading';
        h2.style.marginBottom = '1.5rem';
        h2.textContent = 'Quick Capture';
        body.appendChild(h2);

        var form = document.createElement('div');
        form.style.cssText = 'display:flex; flex-direction:column; gap:1rem;';

        var label = document.createElement('label');
        label.style.cursor = 'pointer';
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'capture-file';
        fileInput.accept = 'image/*';
        fileInput.setAttribute('capture', 'environment');
        fileInput.style.display = 'none';
        fileInput.onchange = function() { window.PhotoUpload.onFileSelected(this); };
        var fileBtn = document.createElement('div');
        fileBtn.className = 'btn btn-messy';
        fileBtn.style.textAlign = 'center';
        fileBtn.textContent = 'Take Photo or Choose File';
        label.appendChild(fileInput);
        label.appendChild(fileBtn);
        form.appendChild(label);

        var preview = document.createElement('div');
        preview.id = 'capture-preview';
        preview.style.display = 'none';
        var previewImg = document.createElement('img');
        previewImg.id = 'capture-preview-img';
        previewImg.style.cssText = 'max-width:100%; max-height:300px; border-radius:4px;';
        preview.appendChild(previewImg);
        form.appendChild(preview);

        var caption = document.createElement('input');
        caption.type = 'text';
        caption.id = 'capture-caption';
        caption.className = 'search-input';
        caption.placeholder = 'Caption or note (optional)';
        form.appendChild(caption);

        var submitBtn = document.createElement('button');
        submitBtn.className = 'btn btn-messy';
        submitBtn.textContent = 'Upload';
        submitBtn.onclick = function() { window.PhotoUpload.submit(); };
        form.appendChild(submitBtn);

        body.appendChild(form);
        document.getElementById('capture-modal').classList.remove('hidden');
    },

    onFileSelected(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var preview = document.getElementById('capture-preview');
                var img = document.getElementById('capture-preview-img');
                if (preview && img) {
                    img.src = e.target.result;
                    preview.style.display = 'block';
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    async submit() {
        var fileInput = document.getElementById('capture-file');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            alert('Please select a photo first.');
            return;
        }
        var caption = document.getElementById('capture-caption');
        var formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (caption && caption.value.trim()) formData.append('caption', caption.value.trim());

        try {
            await window.API.upload('/photos/upload', formData);
            document.getElementById('capture-modal').classList.add('hidden');
            alert('Photo uploaded!');
        } catch (e) {
            alert('Upload failed: ' + e.message);
        }
    }
};
