document.addEventListener('DOMContentLoaded', () => {
  const q1YesBtn = document.getElementById('q1-yes-btn');
  const q1NoBtn = document.getElementById('q1-no-btn');
  const q1ReliefInput = document.getElementById('q1_relief');
  const q1RatingContainer = document.getElementById('q1-rating-container');
  const q1LevelInput = document.getElementById('q1_level');
  const ratingChips = document.querySelectorAll('.rating-chip');

  const surveyForm = document.getElementById('survey-form');
  const surveySection = document.getElementById('survey-section');
  const successScreen = document.getElementById('success-screen');
  const submitBtn = document.getElementById('submit-btn');
  const btnSubmitAnother = document.getElementById('btn-submit-another');

  // Handle Q1 Yes / No Click
  q1YesBtn.addEventListener('click', () => {
    q1ReliefInput.value = 'yes';
    q1YesBtn.classList.add('selected-yes');
    q1NoBtn.classList.remove('selected-no');
    
    // Reveal rating scale smoothly
    q1RatingContainer.style.display = 'block';
  });

  q1NoBtn.addEventListener('click', () => {
    q1ReliefInput.value = 'no';
    q1NoBtn.classList.add('selected-no');
    q1YesBtn.classList.remove('selected-yes');
    
    // Hide rating scale and clear level
    q1RatingContainer.style.display = 'none';
    q1LevelInput.value = '';
    ratingChips.forEach(chip => chip.classList.remove('selected'));
  });

  // Handle Rating Chip Click (1 to 5)
  ratingChips.forEach(chip => {
    chip.addEventListener('click', () => {
      ratingChips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      q1LevelInput.value = chip.dataset.rating;
    });
  });

  // Handle Form Submission
  surveyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prepare payload
    const formData = {
      q1_relief: q1ReliefInput.value || '',
      q1_level: q1LevelInput.value ? Number(q1LevelInput.value) : null,
      q2_flaws: document.getElementById('q2_flaws').value.trim(),
      q3_market_gap: document.getElementById('q3_market_gap').value.trim(),
      q4_alternate: document.getElementById('q4_alternate').value.trim(),
      q5_other_pain: document.getElementById('q5_other_pain').value.trim(),
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim()
    };

    // Button loading state
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving response...</span>';

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // Show success state
        surveySection.style.display = 'none';
        successScreen.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('Network error. Please make sure the server is reachable and try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  });

  // Submit another response
  btnSubmitAnother.addEventListener('click', () => {
    surveyForm.reset();
    q1ReliefInput.value = '';
    q1LevelInput.value = '';
    q1YesBtn.classList.remove('selected-yes');
    q1NoBtn.classList.remove('selected-no');
    q1RatingContainer.style.display = 'none';
    ratingChips.forEach(c => c.classList.remove('selected'));

    successScreen.style.display = 'none';
    surveySection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
