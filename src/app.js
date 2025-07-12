const headers = [
  "User ID", "Age", "Gender", "Height (cm)", "Weight (kg)",
  "Workout Type", "Workout Duration (mins)", "Calories Burned", "Heart Rate (bpm)",
  "Steps Taken", "Distance (km)", "Workout Intensity", "Sleep Hours", "Water Intake (liters)",
  "Daily Calories Intake", "Resting Heart Rate (bpm)", "VO2 Max", "Body Fat (%)",
  "Mood Before Workout", "Mood After Workout"
];

const checkboxesDiv = document.getElementById("checkboxes");
checkboxesDiv.innerHTML = headers.map(header => `
  <label>
    <input type="checkbox" name="fields" value="${header}" checked />
    ${header}
  </label>
`).join("");

document.getElementById("gen-image").addEventListener("click", async () => {
  try {
    const selectedFields = Array.from(document.querySelectorAll('input[name="fields"]:checked'))
      .map(input => input.value);

    const userQuery = document.getElementById("user-query").value.trim();
    const userConstraints = document.getElementById("user-constraints").value.trim();
    const numGenerations = parseInt(document.getElementById("num-generations").value) || 1;
    const apiKey = document.getElementById("api-key").value.trim();
    const provider = document.getElementById("provider").value;

    if (!apiKey || selectedFields.length === 0 || !userQuery || numGenerations < 1) {
      alert("Please enter an API key, select fields, and provide a prompt.");
      return;
    }

    const svgContainer = document.getElementById("svg-container");
    const dataOutput = document.getElementById("data-output");
    svgContainer.innerHTML = "";
    dataOutput.innerHTML = "";

    const fetchPromises = Array.from({ length: numGenerations }, () =>
      fetch(`http://localhost:3000/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: selectedFields,
          prompt: userQuery,
          constraints: userConstraints,
          modelProvider: provider,
          apiKey: apiKey,
        }),
      }).then(res => {
        if (!res.ok) throw new Error("Server error");
        return res.json();
      })
    );

    const results = await Promise.all(fetchPromises);

    results.forEach(({ row, svg }, i) => {
      const dataHTML = `
        <div class="data-block">
          <h3>Workout Data #${i + 1}</h3>
          <ul>
            ${Object.entries(row).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join("")}
          </ul>
        </div>
      `;
      dataOutput.innerHTML += dataHTML;

      const svgWrapper = document.createElement("div");
      svgWrapper.classList.add("svg-wrapper");
      svgWrapper.innerHTML = svg;
      svgContainer.appendChild(svgWrapper);
    });
  } catch (err) {
    console.error("Error:", err);
    alert("Failed to generate SVGs. See console for details.");
  }
});
