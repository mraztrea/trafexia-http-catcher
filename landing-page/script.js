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

    // Scroll effect for navigation
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            if (navMenu.style.display === 'flex') {
                navMenu.style.display = 'none';
            } else {
                navMenu.style.display = 'flex';
                navMenu.style.position = 'absolute';
                navMenu.style.top = '100%';
                navMenu.style.left = '0';
                navMenu.style.right = '0';
                navMenu.style.background = 'var(--color-bg-secondary)';
                navMenu.style.flexDirection = 'column';
                navMenu.style.padding = '1rem';
                navMenu.style.borderTop = '1px solid var(--color-border)';
            }
        });
    }

    // Close menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu) navMenu.style.display = 'none';
        });
    });
}

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
                const offsetTop = target.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Reinitialize Lucide icons when DOM changes
const observer = new MutationObserver(() => {
    lucide.createIcons();
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
});
