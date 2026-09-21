const GOOGLE_CLIENT_ID = '1074575137334-jkheiebc0vh7225gi06jc3cav97b3ces.apps.googleusercontent.com';
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

    if (!currentGoogleUser) {
      alert('Kripya survey submit karne se pehle Google se sign in karein.');
      return;
    }

    const email = currentGoogleUser.email || '';
    const name = currentGoogleUser.name || 'Verified User';

    // Prepare payload
    const formData = {
      q1_relief: q1ReliefInput.value || '',
      q1_level: q1LevelInput.value ? Number(q1LevelInput.value) : null,
      q2_flaws: document.getElementById('q2_flaws').value.trim(),
      q3_market_gap: document.getElementById('q3_market_gap').value.trim(),
      q4_alternate: document.getElementById('q4_alternate').value.trim(),
      q5_other_pain: document.getElementById('q5_other_pain').value.trim(),
      name: name,
      email: email,
      phone: ''
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
