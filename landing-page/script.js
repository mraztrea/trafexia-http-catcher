/**
 * Trafexia Landing Page - Interactive Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initNavigation();
    initSmoothScroll();
    fetchGitHubStars();
});

/**
 * Fetch GitHub stars count
 */
async function fetchGitHubStars() {
    try {
        const response = await fetch('https://api.github.com/repos/danieldev23/trafexia', {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const stars = data.stargazers_count || 500;
            const formattedStars = formatNumber(stars);

            const heroStars = document.getElementById('heroStars');
            if (heroStars) heroStars.textContent = formattedStars + '+';
        }
    } catch (error) {
        console.log('Could not fetch GitHub stars:', error);
    }
}

/**
 * Format number for display
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}

/**
 * Navigation functionality
 */
function initNavigation() {
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect for navigation (throttled)
    const scrollThrottle = throttle(() => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }, 100);

    // Mobile menu toggle
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            const isOpen = navMenu.classList.toggle('is-open');
            // Update aria for accessibility
            navToggle.setAttribute('aria-expanded', isOpen);
        });
    }

    // Close menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('is-open');
            if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
        });
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (navMenu.classList.contains('is-open') &&
            !navMenu.contains(e.target) &&
            !navToggle.contains(e.target)) {
            navMenu.classList.remove('is-open');
            if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
        }
    });

    window.addEventListener('scroll', scrollThrottle, { passive: true });
} // ← closing brace that was missing in the original

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offsetTop = target.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Throttle function for performance
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

/**
 * Reinitialize Lucide icons when new nodes are added.
 * subtree: true so icons inside dynamically appended children are caught.
 */
let iconUpdateTimeout;
const observer = new MutationObserver(throttle(() => {
    clearTimeout(iconUpdateTimeout);
    iconUpdateTimeout = setTimeout(() => {
        lucide.createIcons();
    }, 300);
}, 1000));

observer.observe(document.body, {
    childList: true,
    subtree: true   // was false — missed icons in nested additions
});