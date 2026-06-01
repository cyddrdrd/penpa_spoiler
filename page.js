function setStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status " + type;
}

async function convertOnly() {
  const input = document.getElementById("inputUrl").value.trim();
  const output = document.getElementById("outputUrl");

  output.value = "";

  if (!input) {
    setStatus("Please paste a Penpa solve link first.", "error");
    return null;
  }

  try {
    setStatus("Converting...", "success");

    const result = await convertPenpaUrl(input);

    output.value = result;
    setStatus("Converted successfully.", "success");

    return result;
  } catch (err) {
    setStatus("Error: " + err.message, "error");
    return null;
  }
}

async function convertAndOpen() {
  const result = await convertOnly();

  if (result) {
    window.open(result, "_blank");
  }
}

async function copyOutput() {
  const output = document.getElementById("outputUrl").value.trim();

  if (!output) {
    setStatus("No output link to copy.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(output);
    setStatus("Output URL copied to clipboard.", "success");
  } catch (err) {
    setStatus("Could not copy automatically. Please copy it manually.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("convertOpenButton")
    .addEventListener("click", convertAndOpen);

  document
    .getElementById("convertButton")
    .addEventListener("click", convertOnly);

  document
    .getElementById("copyButton")
    .addEventListener("click", copyOutput);
});
