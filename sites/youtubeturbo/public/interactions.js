'use strict';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const offer = document.querySelector('#venda');

for (const link of document.querySelectorAll('[data-offer-link]')) {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    offer.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth' });
  });
}

const checkoutLink = document.querySelector('[data-checkout]');
const checkout = new URL(checkoutLink.href);
const visit = new URLSearchParams(window.location.search);
const campaignParameters = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'src',
  'fbclid',
];

for (const parameter of campaignParameters) {
  const value = visit.get(parameter);
  if (value) checkout.searchParams.set(parameter, value);
}
checkoutLink.href = checkout.href;

const questions = [...document.querySelectorAll('[data-faq-toggle]')];

function setQuestionState(question, expanded) {
  const region = document.getElementById(question.getAttribute('aria-controls'));
  const state = expanded ? 'open' : 'closed';
  const heading = question.parentElement;

  question.setAttribute('aria-expanded', String(expanded));
  question.dataset.state = state;
  heading.dataset.state = state;
  heading.parentElement.dataset.state = state;
  region.style.setProperty('--radix-accordion-content-height', `${region.firstElementChild.offsetHeight}px`);
  region.hidden = !expanded;
  region.dataset.state = state;
  if (expanded) {
    region.style.setProperty('--radix-accordion-content-height', `${region.scrollHeight}px`);
  }
}

for (const [index, question] of questions.entries()) {
  question.addEventListener('click', () => {
    const expanded = question.getAttribute('aria-expanded') === 'true';
    const current = questions.find((item) => item.getAttribute('aria-expanded') === 'true');

    if (current) setQuestionState(current, false);
    if (!expanded) setQuestionState(question, true);
  });

  question.addEventListener('keydown', (event) => {
    const nextIndex = {
      Home: 0,
      End: questions.length - 1,
      ArrowDown: (index + 1) % questions.length,
      ArrowUp: (index + questions.length - 1) % questions.length,
    }[event.key];

    if (nextIndex === undefined) return;
    event.preventDefault();
    questions[nextIndex].focus();
  });
}

for (const carousel of document.querySelectorAll('[data-carousel]')) {
  const type = carousel.dataset.carousel;
  const viewport = carousel.querySelector('[data-carousel-window]');
  const track = carousel.querySelector('[data-carousel-track]');
  const slides = [...track.children];
  const [previous, next] = carousel.querySelectorAll('button[aria-label]');
  const dots = [...carousel.querySelectorAll('button[aria-label^="Ver depoimento"]')];
  let active = 0;
  let drag;

  const maxOffset = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
  const offsetFor = (index) => {
    const slide = slides[index];
    const left = slide.offsetLeft - slides[0].offsetLeft;
    const adjustment = type === 'testimonials' ? (viewport.clientWidth - slide.offsetWidth) / 2 : 0;

    return Math.min(maxOffset(), Math.max(0, left - adjustment));
  };

  function paint(offset, animate) {
    track.style.transition = animate && !prefersReducedMotion.matches ? 'transform 320ms ease' : 'none';
    track.style.transform = `translate3d(-${offset}px, 0, 0)`;
  }

  function show(index, animate = true) {
    active = (index + slides.length) % slides.length;
    paint(offsetFor(active), animate);
    for (const [position, dot] of dots.entries()) {
      const selected = position === active;

      dot.classList.toggle('w-6', selected);
      dot.classList.toggle('bg-[#2563EB]', selected);
      dot.classList.toggle('w-2', !selected);
      dot.classList.toggle('bg-white/20', !selected);
      if (selected) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    }
  }

  previous.addEventListener('click', () => show(active - 1));
  next.addEventListener('click', () => show(active + 1));
  for (const [index, dot] of dots.entries()) {
    dot.addEventListener('click', () => show(index));
  }

  viewport.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { pointer: event.pointerId, start: event.clientX, offset: offsetFor(active) };
    track.classList.add('is-dragging');
    track.style.cursor = 'grabbing';
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener('pointermove', (event) => {
    if (drag?.pointer !== event.pointerId) return;
    const offset = drag.offset + drag.start - event.clientX;
    paint(Math.min(maxOffset(), Math.max(0, offset)), false);
  });

  function finishDrag(event) {
    if (drag?.pointer !== event.pointerId) return;
    const distance = drag.start - event.clientX;
    const threshold = 32;

    drag = undefined;
    track.classList.remove('is-dragging');
    track.style.cursor = 'grab';
    if (event.type === 'pointerup' && Math.abs(distance) >= threshold) {
      show(active + Math.sign(distance));
    } else {
      show(active);
    }
  }

  viewport.addEventListener('pointerup', finishDrag);
  viewport.addEventListener('pointercancel', finishDrag);
  viewport.addEventListener('lostpointercapture', finishDrag);
  viewport.addEventListener('dragstart', (event) => event.preventDefault());

  new ResizeObserver(() => {
    if (!drag) show(active, false);
  }).observe(viewport);

  show(0, false);
}
