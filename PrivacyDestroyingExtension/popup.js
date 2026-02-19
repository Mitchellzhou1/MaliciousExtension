document.addEventListener("DOMContentLoaded", function () {
    document.body.style.width = "450px"; // Ensure width is applied dynamically
    document.body.style.height = "auto";

    const iframeContainer = document.getElementById("iframeContainer");
    const loadingMessage = document.getElementById("loadingMessage");
    const iframe = document.getElementById("cryptoIframe");

    iframeContainer.style.display = "block";
    loadingMessage.style.display = "none";
});
