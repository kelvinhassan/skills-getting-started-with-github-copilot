document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const submitButton = signupForm.querySelector('button[type="submit"]');

  // Helper: attach remove handler to a remove button element
  function addRemoveHandler(btn) {
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const activityName = btn.getAttribute('data-activity');
      const email = btn.getAttribute('data-email');

      const confirmed = window.confirm(`Remove ${email} from ${activityName}?`);
      if (!confirmed) return;

      try {
        const res = await fetch(
          `/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`,
          { method: 'DELETE' }
        );

        const payload = await res.json();
        if (res.ok) {
          messageDiv.textContent = payload.message;
          messageDiv.className = 'success';
          messageDiv.classList.remove('hidden');
          setTimeout(() => messageDiv.classList.add('hidden'), 4000);
          // Refresh the UI for that activity by re-fetching (safe) or removing the li.
          // We'll re-fetch to keep server and client in sync for deletes.
          fetchActivities();
        } else {
          messageDiv.textContent = payload.detail || 'Failed to remove participant';
          messageDiv.className = 'error';
          messageDiv.classList.remove('hidden');
        }
      } catch (err) {
        console.error('Error removing participant:', err);
        messageDiv.textContent = 'Failed to remove participant. Please try again.';
        messageDiv.className = 'error';
        messageDiv.classList.remove('hidden');
      }
    });
  }

  // Helper: update a single activity card in-place after a successful signup
  function updateCardAfterSignup(activityName, email) {
    const cards = Array.from(document.querySelectorAll('.activity-card'));
    const card = cards.find(c => (c.querySelector('h4') && c.querySelector('h4').textContent === activityName));
    if (!card) {
      // If we can't find the card, fall back to re-fetching everything
      fetchActivities();
      return;
    }

    // Update availability (decrement by 1 if present)
    const availP = Array.from(card.querySelectorAll('p')).find(p => p.textContent.includes('Availability:'));
    if (availP) {
      const match = availP.textContent.match(/(\d+) spots left/);
      if (match) {
        let spots = parseInt(match[1], 10);
        if (!Number.isNaN(spots)) {
          spots = Math.max(0, spots - 1);
          availP.innerHTML = `<strong>Availability:</strong> ${spots} spots left`;
        }
      }
    }

    const participantsDiv = card.querySelector('.participants');
    if (participantsDiv && participantsDiv.querySelector('ul')) {
      const ul = participantsDiv.querySelector('ul');
      const li = document.createElement('li');
      li.innerHTML = `<span class="participant-email">${email}</span> <button class="remove-participant" data-activity="${activityName}" data-email="${email}" title="Remove participant">&times;</button>`;
      ul.appendChild(li);

      // Update the count in the heading
      const h5 = participantsDiv.querySelector('h5');
      if (h5) {
        const m = h5.textContent.match(/Participants \((\d+)\)/);
        if (m) {
          const newCount = parseInt(m[1], 10) + 1;
          h5.textContent = `Participants (${newCount})`;
        }
      }

      // Attach remove handler for the new button
      addRemoveHandler(li.querySelector('.remove-participant'));
    } else {
      // No participants present currently - create the block
      const container = document.createElement('div');
      container.className = 'participants';
      container.innerHTML = `
        <h5>Participants (1)</h5>
        <ul>
          <li>
            <span class="participant-email">${email}</span>
            <button class="remove-participant" data-activity="${activityName}" data-email="${email}" title="Remove participant">&times;</button>
          </li>
        </ul>
      `;

      // Insert after the availability paragraph if possible, otherwise append
      if (availP && availP.parentNode) {
        availP.insertAdjacentElement('afterend', container);
      } else {
        card.appendChild(container);
      }

      addRemoveHandler(container.querySelector('.remove-participant'));
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Clear previous activity-select options (keep placeholder)
      activitySelect.querySelectorAll('option:not([value=""])').forEach((o) => o.remove());

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants HTML: each participant has a small delete icon/button.
        const participantsHTML = details.participants && details.participants.length
          ? `<div class="participants"><h5>Participants (${details.participants.length})</h5><ul>${details.participants.map((p) => `<li><span class="participant-email">${p}</span><button class="remove-participant" data-activity="${name}" data-email="${p}" title="Remove participant">&times;</button></li>`).join("")}</ul></div>`
          : `<div class="participants info">No participants yet</div>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsHTML}
        `;

        activitiesList.appendChild(activityCard);

        // Attach remove handlers for buttons in this card
        activityCard.querySelectorAll('.remove-participant').forEach(addRemoveHandler);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    // disable submit to prevent double submits
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Update the specific activity card in-place instead of re-fetching everything
        updateCardAfterSignup(activity, email);
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // Initialize app
  fetchActivities();
});
