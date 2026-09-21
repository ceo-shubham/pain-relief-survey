const GOOGLE_CLIENT_ID = '1074575137334-g2e52hi7sm806v9d2gt7g938jvh8lhpa.apps.googleusercontent.com';
const SESSION_STORAGE_KEY = 'survey_google_user';

let currentGoogleUser = null;

// JWT Decoder for Google ID Token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const surveyForm = document.getElementById('survey-form');
  const surveySection = document.getElementById('survey-section');
  const successScreen = document.getElementById('success-screen');
  const submitBtn = document.getElementById('submit-btn');
  const btnSubmitAnother = document.getElementById('btn-submit-another');

  // Handle Option Card Selections for all question grids
  const optionGrids = document.querySelectorAll('.options-grid');
  optionGrids.forEach(grid => {
    const questionName = grid.dataset.question;
    const hiddenInput = document.getElementById(questionName);
    const optionCards = grid.querySelectorAll('.option-card');

    optionCards.forEach(card => {
      card.addEventListener('click', () => {
        // Remove selected state from sibling cards in the same grid
        optionCards.forEach(c => c.classList.remove('selected'));
        // Add selected to clicked card
        card.classList.add('selected');
        // Update hidden input
        if (hiddenInput) {
          hiddenInput.value = card.dataset.value;
        }
      });
    });
  });

  // Handle Form Submission
  surveyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentGoogleUser) {
      alert('Please sign in with your Google account before submitting the survey.');
      return;
    }

    const q1 = document.getElementById('q1_rashes').value;
    const q2 = document.getElementById('q2_stinging').value;
    const q3 = document.getElementById('q3_dampness').value;
    const q4 = document.getElementById('q4_skin_texture').value;
    const q5 = document.getElementById('q5_odor_control').value;
    const q6 = document.getElementById('q6_absorption').value;
    const q7 = document.getElementById('q7_leakage').value;
    const q8 = document.getElementById('q8_overall_experience').value;

    // Check if any question is missed
    const missing = [];
    if (!q1) missing.push('Q1 (Rashes/Itching)');
    if (!q2) missing.push('Q2 (Stinging/Burning)');
    if (!q3) missing.push('Q3 (Dampness/Sweat)');
    if (!q4) missing.push('Q4 (Vulvar Skin Condition)');
    if (!q5) missing.push('Q5 (Odor Control)');
    if (!q6) missing.push('Q6 (Absorption Speed)');
    if (!q7) missing.push('Q7 (Side Leakage)');
    if (!q8) missing.push('Q8 (Overall Comparison)');

    if (missing.length > 0) {
      alert(`Please select an answer for all questions before submitting.\nUnanswered questions: ${missing.join(', ')}`);
      return;
    }

    const email = currentGoogleUser.email || '';
    const name = currentGoogleUser.name || 'Verified User';

    // Prepare payload
    const formData = {
      q1_rashes: q1,
      q2_stinging: q2,
      q3_dampness: q3,
      q4_skin_texture: q4,
      q5_odor_control: q5,
      q6_absorption: q6,
      q7_leakage: q7,
      q8_overall_experience: q8,
      name: name,
      email: email,
      phone: ''
    };

    // Button loading state
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving VYVIA response...</span>';

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
    document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('input[type="hidden"]').forEach(input => {
      input.value = '';
    });

    successScreen.style.display = 'none';
    surveySection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Initialize Google Auth
  initGoogleAuth();
});

// Google Identity Services Setup
function initGoogleAuth() {
  const authLoading = document.getElementById('auth-loading');
  const authSignedOut = document.getElementById('auth-signed-out');
  const authSignedIn = document.getElementById('auth-signed-in');
  const userEmailDisplay = document.getElementById('user-email-display');
  const userNameDisplay = document.getElementById('user-name-display');
  const userAvatarImg = document.getElementById('user-avatar-img');
  const userAvatarDefault = document.getElementById('user-avatar-default');
  const surveyForm = document.getElementById('survey-form');
  const btnGoogleLogout = document.getElementById('btn-google-logout');

  // Check saved session
  try {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      currentGoogleUser = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading session:', e);
  }

  function renderAuthState() {
    if (currentGoogleUser && currentGoogleUser.email) {
      if (userEmailDisplay) userEmailDisplay.textContent = currentGoogleUser.email;
      if (userNameDisplay) userNameDisplay.textContent = currentGoogleUser.name || 'Signed In';
      
      if (currentGoogleUser.picture && userAvatarImg) {
        userAvatarImg.src = currentGoogleUser.picture;
        userAvatarImg.style.display = 'block';
        if (userAvatarDefault) userAvatarDefault.style.display = 'none';
      } else {
        if (userAvatarImg) userAvatarImg.style.display = 'none';
        if (userAvatarDefault) userAvatarDefault.style.display = 'flex';
      }

      if (authLoading) authLoading.style.display = 'none';
      if (authSignedOut) authSignedOut.style.display = 'none';
      if (authSignedIn) authSignedIn.style.display = 'flex';
      if (surveyForm) surveyForm.style.display = 'block';
    } else {
      currentGoogleUser = null;
      if (authLoading) authLoading.style.display = 'none';
      if (authSignedIn) authSignedIn.style.display = 'none';
      if (authSignedOut) authSignedOut.style.display = 'block';
      if (surveyForm) surveyForm.style.display = 'none';
    }
    if (window.feather) feather.replace();
  }

  // Handle Google OAuth Credential
  window.handleGoogleCredentialResponse = function(response) {
    const payload = parseJwt(response.credential);
    if (payload && payload.email) {
      currentGoogleUser = {
        email: payload.email,
        name: payload.name || payload.given_name || 'Verified User',
        picture: payload.picture || ''
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentGoogleUser));
      renderAuthState();
    }
  };

  // Render initial state
  renderAuthState();

  // Setup GIS when script is loaded
  function setupGis() {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      setTimeout(setupGis, 100);
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: window.handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      const btnWrapper = document.getElementById('google-btn-wrapper');
      if (btnWrapper) {
        window.google.accounts.id.renderButton(btnWrapper, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          width: 280
        });
      }

      // One Tap Prompt if not logged in
      if (!currentGoogleUser) {
        window.google.accounts.id.prompt();
      }
    } catch (err) {
      console.error('Error initializing Google Identity Services:', err);
    }
  }

  setupGis();

  // Handle Logout / Switch
  if (btnGoogleLogout) {
    btnGoogleLogout.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      currentGoogleUser = null;
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
      }
      renderAuthState();
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.prompt();
      }
    });
  }
}
