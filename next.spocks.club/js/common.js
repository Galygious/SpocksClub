'use strict';

import {
  TimeResourceIds
} from './prime/resources.js';

export const API_BASE_URL = 'https://api.spocks.club';

let resourceData;
let resourceTranslations;
let resourcesLoading;
const resourceMap = new Map();

let popovers = [];
let tooltips = [];

$(function() {
  if (parseInt($('#userid').val()) <= 0) {
    $('.login-warning').removeClass('d-none');
  }

  $('body').on('rendered.spock', /** jQuery.Event */ event => {
    initLabels();
    initPopovers();
    initTooltips();
    cleanupTables();
    format_numbers(event.target);
    format_timers(event.target);
    lookup_resources(event.target).catch(error => console.log(error.stack));
  });

  animateBrand();
  updateLoginButtons();
  acceptCookies();
  getOneTimePassword();
  useOneTimePassword();

  $(window).on('scroll', debounce(toggleScrollToTopBtn, 100));
});

/**
 * Scroll to top
 */
function toggleScrollToTopBtn() {
  if ($(window).scrollTop() > 100) {
    $('#scrollToTopBtn').fadeIn();
  } else {
    $('#scrollToTopBtn').fadeOut();
  }

  window.scrollToTop = function() {
    $('html, body').animate({
      scrollTop: 0
    }, 'smooth');
  };
}

/**
 * Cleanup tables
 */
function cleanupTables() {
  $('table.sc-hide-if-empty').each((index, element) => {
    const table = $(element);

    if (table.find('tbody > tr').filter(':not(.efficiency-table-divider, .efficiency-placeholder, .d-none)').length === 0) {
      table.addClass('d-none');
    } else {
      table.removeClass('d-none');
    }
  });

  $('.max-colspan').each((index, element) => {
    const row = $(element);
    const header = row.closest('table').children('thead').children('tr');
    const columns = header.children('th').length;
    row.attr('colspan', columns).removeClass('max-colspan');
  });
}

/**
 * Initialize an auto-update mechanism for range labels
 */
function initLabels() {
  const ranges = $('.range-update-label').not('[data-label-handler-installed="1"]');

  ranges.on('input applied.spock.settings', /** Event */ event => {
    updateLabel(event.target);
  }).attr('data-label-handler-installed', 1);
}

/**
 * Updates the text content of a label associated with a given range input element.
 *
 * The method finds the label element associated with the provided range input and
 * updates its text content. If the range value is 0 and the label contains a
 * `data-zero-text` attribute, that value will be used. Otherwise, the range value
 * is formatted as a localized decimal.
 *
 * @param {HTMLInputElement} range The `<input type="range">` element whose associated label is to be updated.
 * @return {void} No return value.
 */
export function updateLabel(range) {
  const label = document.querySelector(`label[for="${range.id}"]`);
  if (label === null) {
    return;
  }

  const target = label.querySelector('span.update-target') || label;
  if (target !== null) {
    if (range.value == 0 && target.dataset.zeroText !== undefined) {
      target.textContent = target.dataset.zeroText;
    } else {
      target.textContent = Number(range.value).toLocaleString(undefined, {
        style: 'decimal',
        maximumFractionDigits: 2,
        trailingZeroDisplay: 'stripIfInteger',
        roundingMode: 'halfCeil',
        useGrouping: true
      });
    }
  }
}

/**
 * Initialize popovers
 */
function initPopovers() {
  const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"], [data-secondary-toggle="popover"]');
  popovers = [...popoverTriggerList].map(popoverTriggerEl => bootstrap.Popover.getOrCreateInstance(popoverTriggerEl));
}

/**
 * Initialize tooltips
 */
function initTooltips() {
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"], [data-secondary-toggle="tooltip"]');
  tooltips = [...tooltipTriggerList].map(tooltipTriggerEl => bootstrap.Tooltip.getOrCreateInstance(tooltipTriggerEl));
}

/**
 * Animate the transporter-inspired brand in the top left
 *
 * @param {number} transporterState
 */
function animateBrand(transporterState = 0) {
  const brand = $('.mytransporter, .spocksclub-brand');
  const animationDelay = 5000;

  if (brand.length === 0) {
    return;
  }

  const icons = ['fa-transporter', 'fa-transporter-1', 'fa-transporter-2', 'fa-transporter-3', 'fa-transporter-4', 'fa-transporter-5', 'fa-transporter-6', 'fa-transporter-7', 'fa-transporter-empty'];
  brand.removeClass(icons);

  switch (transporterState) {
  case 0:
    brand.addClass('fa-transporter');
    setTimeout(animateBrand, animationDelay, ++transporterState);
    break;
  case 1:
    brand.addClass('fa-transporter-1');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 2:
    brand.addClass('fa-transporter-2');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 3:
    brand.addClass('fa-transporter-3');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 4:
    brand.addClass('fa-transporter-4');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 5:
    brand.addClass('fa-transporter-5');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 6:
    brand.addClass('fa-transporter-6');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 7:
    brand.addClass('fa-transporter-7');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 8:
    brand.addClass('fa-transporter-empty');
    setTimeout(animateBrand, animationDelay, ++transporterState);
    break;
  case 9:
    brand.addClass('fa-transporter-7');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 10:
    brand.addClass('fa-transporter-6');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 11:
    brand.addClass('fa-transporter-5');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 12:
    brand.addClass('fa-transporter-4');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 13:
    brand.addClass('fa-transporter-3');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 14:
    brand.addClass('fa-transporter-2');
    setTimeout(animateBrand, 250, ++transporterState);
    break;
  case 15:
    brand.addClass('fa-transporter-1');
    setTimeout(animateBrand, 250, 0);
    break;
  }
}

/**
 * Make big numbers human-readable
 *
 * @param {*|number} num
 * @param include_sign
 * @returns {string}
 */
export function moolah_round(num, include_sign = false) {
  const n = Number(num);
  const abs = Math.abs(n);
  let value, suffix;

  if (abs >= 1.0e+15) {
    // Twelve Zeroes for Trillions
    value = abs / 1.0e+12;
    suffix = ' Qd';
  } else if (abs >= 1.0e+12) {
    value = abs / 1.0e+12;
    suffix = ' T';
  } else if (abs >= 1.0e+9) {
    // Nine Zeroes for Billions
    value = abs / 1.0e+9;
    suffix = ' B';
  } else if (abs >= 1.0e+6) {
    // Six Zeroes for Millions
    value = abs / 1.0e+6;
    suffix = ' M';
  } else if (abs >= 1.0e+3) {
    // Three Zeroes for Thousands
    value = abs / 1.0e+3;
    suffix = ' K';
  } else {
    // No suffix
    value = abs;
    suffix = '';
  }

  value = Math.sign(n) * value;
  const style = new Intl.NumberFormat(undefined, {
    style: 'decimal',
    maximumFractionDigits: 2,
    roundingMode: 'halfCeil',
    useGrouping: true,
    signDisplay: include_sign ? 'always' : 'auto'
  });
  return `${style.format(value)}${suffix}`;
}

/**
 * Round num to at most 2 decimal places
 *
 * @deprecated
 * @param {*|number} num
 * @returns {number}
 */
function round_to_two(num) {
  return +(Math.round(num + 'e+2') + 'e-2');
}

/**
 * Format number
 *
 * @param {number} num
 * @param {string} [format]
 * @param variant
 */
export function format_number(num, format = 'rounded', variant = 'default') {
  switch (format) {
  case 'exact':
    return num.toLocaleString(undefined, {
      style: 'decimal',
      maximumFractionDigits: 2,
      roundingMode: 'halfCeil',
      useGrouping: true,
      signDisplay: variant === 'delta' ? 'always' : 'auto'
    });
  case 'percent':
    return num.toLocaleString(undefined, {
      style: 'percent',
      maximumFractionDigits: 2,
      roundingMode: 'halfCeil',
      useGrouping: true,
      signDisplay: variant === 'delta' ? 'always' : 'auto'
    });
  case 'decimal':
    return num.toLocaleString(undefined, {
      style: 'decimal',
      maximumFractionDigits: 8,
      roundingMode: 'halfCeil',
      useGrouping: true,
      signDisplay: variant === 'delta' ? 'always' : 'auto'
    });
  case 'exact-if-small':
    return Math.abs(num) <= 1000000 ?
      num.toLocaleString(undefined, {
        style: 'decimal',
        maximumFractionDigits: 2,
        roundingMode: 'halfCeil',
        useGrouping: true,
        signDisplay: variant === 'delta' ? 'always' : 'auto'
      }) :
      moolah_round(num, variant === 'delta');
  case 'rounded':
  default:
    return moolah_round(num, variant === 'delta');
  }
}

/**
 * Format numbers in HTML elements with .format-num
 * (requires data-amount attribute)
 *
 * Optionally, a format (exact, percent, rounded)
 * can be specified via the data-format attribute
 *
 * @param selector
 */
export function format_numbers(selector = undefined) {
  let elements;

  if (selector === undefined) {
    elements = $('.format-num');
  } else {
    elements = $(selector).find('.format-num');
  }

  elements.each(function(index, item) {
    const i = $(item);
    let value;

    if (i.attr('data-amount')) {
      value = Number(i.attr('data-amount'));
    } else {
      value = Number(i.text());
    }

    i.text(format_number(value, item.dataset.format, item.dataset.variant));
  });
}

/**
 * Returns a human-readable duration
 *
 * @param {number} seconds
 * @returns {string}
 */
export function format_duration(seconds) {
  if (seconds === 0) {
    return '0s';
  }

  const timeUnits = [{
    label: 'y',
    duration: 365 * 24 * 60 * 60
  },
  // { label: 'mo', duration: 30 * 24 * 60 * 60 },
  // { label: 'w', duration: 7 * 24 * 60 * 60 },
  {
    label: 'd',
    duration: 24 * 60 * 60
  },
  {
    label: 'h',
    duration: 60 * 60
  },
  {
    label: 'm',
    duration: 60
  },
  {
    label: 's',
    duration: 1
  }
  ];

  let remainingSeconds = seconds;
  let result = '';

  for (let i = 0; i < timeUnits.length; i++) {
    const {
      label,
      duration
    } = timeUnits[i];
    const value = Math.floor(remainingSeconds / duration);

    if (value > 0) {
      result += `${value}${label} `;
      remainingSeconds %= duration;
    }
  }

  return result.trim();
}

/**
 * Formats timers/durations in HTML elements with .format-duration
 *
 * @param selector
 */
export function format_timers(selector = undefined) {
  let elements;

  if (selector === undefined) {
    elements = $('.format-duration');
  } else {
    elements = $(selector).find('.format-duration');
  }

  elements.each(function(index, item) {
    const i = $(item);
    let value;

    if (i.attr('data-seconds')) {
      value = parseInt(i.attr('data-seconds'));
    } else {
      value = i.html();
    }

    // i.removeClass('format-duration');
    i.html(format_duration(value));
  });
}

/**
 * Returns rendered icon and name for a given resource
 * @deprecated Use prime/resources.js instead
 *
 * @param resource
 * @param style
 * @param includeName
 * @return {string}
 */
function format_resource(resource, style = 'max-height: 24px;', includeName = true) {
  if (typeof resource === 'object') {
    // `<div class="resource" style="background-image:url('/assets/prime/resources/${resource.art_id}.png')"></div>${resource.name}`
    return `<img class="resource-icon object-fit-scale me-1" style="${style}" src="/assets/prime/resources/${resource.art_id}.png" alt="${resource.name}" data-resource="${resource.id}">` + (includeName ? `${resource.name}` : '');
  }

  const timeResource = TimeResourceIds[resource];
  if (timeResource !== undefined) {
    return `<i class="fa-solid ${timeResource.icon} fa-lg me-1" style="padding: 3.25px;" data-time-resource="${timeResource.id}"></i>${timeResource.name}`;
  }
}

/**
 * Formats resources in HTML elements with .lookup-resource
 * @deprecated Use prime/resources.js instead
 *
 * @param selector
 * @param style
 * @return {Promise<void>}
 */
export async function lookup_resources(selector = undefined, style = 'max-height: 24px;') {
  let elements;

  if (selector === undefined) {
    elements = $('.lookup-resource');
  } else {
    elements = $(selector).find('.lookup-resource');
  }

  const promises = [];

  elements.each(function(ev, item) {
    const id = Number($(item).attr('data-resource'));
    promises.push(fetch_resource(id).then(resource => {
      $(item).html(format_resource(resource || id, style));
      $(item).removeClass('lookup-resource');
    }));
  });

  await Promise.all(promises);
}

/**
 * Asynchronously fetch details for a given resource
 * @deprecated Use prime/resources.js instead
 *
 * @param resource_id
 * @return {Promise<{loca_id: number, art_id: number, sorting_key: string, grade, name: string, sorting_index: number, id: number, rarity: string}|undefined>}
 */

export async function fetch_resource(resource_id) {
  const resource = resourceMap.get(resource_id);
  if (resource !== undefined) {
    return resource;
  }

  if (resourceData === undefined || resourceTranslations === undefined) {
    if (resourcesLoading === undefined) {
      resourcesLoading = Promise.withResolvers();

      try {
        [resourceData, resourceTranslations] = await Promise.all([
          $.getJSON(`${API_BASE_URL}/resource`),
          $.getJSON(`${API_BASE_URL}/translations/en/resources`)
        ]);
      } catch (e) {
        resourcesLoading.reject(e);
        throw e;
      }

      resourcesLoading.resolve([resourceData, resourceTranslations]);
    } else {
      await resourcesLoading.promise;
    }
  }

  const data = resourceData.find(({
    id
  }) => resource_id === id);
  if (data === undefined) {
    return;
  }

  const translation = getTranslation(resourceTranslations, `resource_name_${data.loca_id}`);
  const entry = {
    id: data.id,
    art_id: data.art_id,
    loca_id: data.loca_id,
    grade: data.grade,
    rarity: data.rarity,
    sorting_index: data.sorting_index,
    sorting_key: `${data.sorting_index.toString().padStart(6, '0')}-${data.grade}-${data.rarity}-${translation}`,
    name: translation
  };

  resourceMap.set(entry.id, entry);
  return entry;
}

/**
 * Retrieves the translation text for a given key from the provided data array.
 * @param {Array} data - The array of translation objects.
 * @param {string} key - The key to search for in the translation objects.
 * @param {boolean} [useId=false] - Whether to use the 'id' property instead of the 'key' property to search for the translation.
 * @param {string} [startsWith=''] - Optional string to check if the key starts with it.
 * @param fallback
 * @returns {string} - The translation text if found, otherwise 'Missing translation'.
 * @deprecated Use prime/translations.js instead
 */
export function getTranslation(data, key, useId = false, startsWith = '', fallback = 'Missing translation') {
  const translation = data.find(item => useId ? item.id === key && item.key.startsWith(startsWith) : item.key === key && item.key.startsWith(startsWith));
  return translation ? translation.text : fallback;
}

/**
 * Convert a decimal number to roman numerals
 *
 * @param {number} num
 * @return {string}
 */
export function toRomanNumerals(num) {
  if (num < 1 || num > 3999 || !Number.isInteger(num)) {
    return num.toLocaleString(undefined, {
      useGrouping: true
    });
  }

  const lookup = [
    ['M', 1000],
    ['CM', 900],
    ['D', 500],
    ['CD', 400],
    ['C', 100],
    ['XC', 90],
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1]
  ];

  return lookup.reduce((acc, [k, v]) => {
    acc += k.repeat(Math.floor(num / v));
    num = num % v;
    return acc;
  }, '');
}

/**
 * Remove diacritics and other special characters
 *
 * @param {string} text
 * @return {string}
 */
export function normalizeText(text) {
  return text.normalize('NFD')
    .replace(/[\u0300-\u036f]|'/g, '')
    .replace(/\*|\\\*|★|⇴|⇵/g, '*')
    .replace(/-/g, ' ')
    .replace(/Σ/g, 'sigma')
    .replace(/Ω/g, 'omega')
    .replace(/  +/g, ' ');
}

/**
 * Strip all HTML tags from a given text
 *
 * @param text
 * @return {string}
 */
export function stripHTML(text) {
  if (text === undefined || text === null || text === '') {
    return text;
  }

  const element = document.createElement('div');
  element.innerHTML = text;
  return element.textContent;
}

/**
 *
 * @param func
 * @param timeout
 * @return {(function(...[*]): void)|*}
 */
export function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), timeout);
  };
}

/**
 * Retrieves the value of a cookie by its name.
 *
 * @param {string} name - The name of the cookie.
 * @returns {string|null} - The value of the cookie, or null if the cookie does not exist.
 */
function getCookie(name) {
  const prefix = name + '=';
  const cookies = document.cookie.split('; ');

  for (const cookie of cookies) {
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.substring(prefix.length));
    }
  }

  return null;
}

function setCookie(name, value, days) {
  // TODO: use browser.cookies.set instead
  // TODO: check cookie consent

  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = '; expires=' + date.toUTCString();
  }

  document.cookie = `${name}=${encodeURIComponent(value || '')}${expires}; path=/`;
}

function acceptCookies() {
  $('#myacceptcookies').on('click', () => {
    setCookie('acceptcookies', '1', 500);
    $('#privacy').modal('toggle');
    $('#loginwindow').modal('toggle');
  });
}

/**
 * Updates the login buttons behavior.
 *
 * @function updateLoginButtons
 * @returns {void}
 */
function updateLoginButtons() {
  $('.mylogin').click(function() {
    $('#closemenu').click();
    const cookie = Number(getCookie('acceptcookies'));

    if (cookie === 1) {
      $('#loginwindow').modal('toggle');
    } else {
      $('#privacy').modal('toggle');
    }
  });

  $('.mylogout').click(function() {
    $.post('/ajax.php', {
      a: 4
    })
      .done(function() {});

    // Clear user input fields
    $('#userid, #useremail').val('');

    // Remove all logout buttons
    $('.mylogout').remove();

    // Show login warning message
    $('.loginwarning').show();

    // Update login buttons (assumed function)
    updateLoginButtons();
  });
}

function getOneTimePassword() {
  $('#getonetimepassword').on('click', () => {
    $('#working').html('Sending &hellip;');

    $.ajax({
      url: '/ajax.php',
      type: 'POST',
      data: {
        a: 2,
        email: $('#email').val(),
        inviteCode: $('#inviteCodeInput').val()
      }
    }).done(data => {
      $('#randstr').val(data);
      $('#working').html('');
      $('#loginwindow').modal('toggle');
      $('#onetimewindow').modal('toggle');
    }).fail((jqXHR, textStatus) => {
      const errorMessage = jqXHR.responseJSON ? jqXHR.responseJSON.msg : 'An error occurred.';
      $('#working').html(`<span class="text-danger-emphasis">${errorMessage}</span>`);

      if (errorMessage === 'User registration limit reached') {
        $('#inviteCodeMsg').html('Have an invitation code? Click <a href="#" id="inviteCodeLink">here</a> to enter it.');
      }

      $('#inviteCodeLink').on('click', () => {
        $('#inviteCodeMsg').html('');
        $('#inviteCode').removeClass('d-none');
      });
    });
  });
}

export function displayInLocalTimezone(dateTimeString, short = false) {
  // Parse the input string into a Date object
  const date = new Date(dateTimeString);

  // Check for invalid date
  if (Number.isNaN(date.valueOf())) {
    throw new Error('Invalid date format');
  }

  // Decide which options to use based on `short`
  const options = short ?
    {
      year: 'numeric',
      month: 'short', // e.g. "Aug"
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    } :
    {
      year: 'numeric',
      month: 'long', // e.g. "August"
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    };

  // Create a formatter for the user's local timezone
  const formatter = new Intl.DateTimeFormat(undefined, options);

  // Format the date into a localized string
  return formatter.format(date);
}

function useOneTimePassword() {
  $('#useonetimepassword').on('click', () => {
    $('#loginstatus').html('Logging in &hellip;');

    $.ajax({
      url: '/ajax.php',
      type: 'POST',
      data: {
        a: 3,
        randstr: $('#randstr').val(),
        token: $('#onetimepass').val()
      },
      dataType: 'JSON'
    }).done(data => {
      if (data.status == 1) {
        $('#loginstatus').html('');
        $('#onetimewindow').modal('toggle');
        $('#userid').val(data.id);
        $('#useremail').val(data.email);
        $('.mylogin').remove();
        $('.loginwarning').hide();
      } else {
        $('#loginstatus').html(data.msg);
      }
    }).fail((jqXHR, textStatus) => {
      const errorMessage = jqXHR.responseJSON ? jqXHR.responseJSON.msg : 'An error occurred.';
      $('#loginstatus').html(`<span class="text-danger-emphasis">${errorMessage}</span>`);
    });
  });
}

/**
 * Copy text to clipboard
 *
 * @param {string} text The string to be written to the clipboard.
 * @return {Promise<void>}
 */
export async function copyToClipboard(text) {
  // Clipboard API needs a secure context
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  // Fallback method
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // make the textarea out of viewport
  textArea.ariaHidden = 'true';
  textArea.style.all = 'unset';
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.clip = 'rect(0, 0, 0, 0)';
  textArea.style.whiteSpace = 'pre';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const success = document.execCommand('copy');
  textArea.remove();

  if (!success) {
    throw new Error('Failed to copy text content to clipboard');
  }
}

/**
 * Copies the provided content to the clipboard and provides visual feedback through a tooltip.
 * If the tooltip instance is available on the specified element, it updates the tooltip's content
 * to indicate success or failure. The tooltip then hides after a short delay and resets to its
 * default state. If there is no tooltip, the method will try to copy the content silently.
 *
 * @param {string} content - The text content to be copied to the clipboard.
 * @param {HTMLElement} element - The DOM element associated with the tooltip for visual feedback.
 * @return {Promise<void>} A promise that resolves when the clipboard operation and feedback updates are completed.
 */
export async function copyToClipboardWithFeedback(content, element) {
  const tooltip = bootstrap.Tooltip.getInstance(element);

  if (tooltip) {
    try {
      await copyToClipboard(content);
    } catch (e) {
      tooltip.setContent({
        '.tooltip-inner': 'Failed :('
      });
      tooltip.show();

      setTimeout(() => {
        tooltip.hide();
      }, 5000);

      element.one('hidden.bs.tooltip', () => {
        tooltip.setContent({
          '.tooltip-inner': 'Copy to Clipboard'
        });
      });

      return;
    }

    tooltip.setContent({
      '.tooltip-inner': 'Copied!'
    });
    tooltip.show();

    setTimeout(() => {
      tooltip.hide();
    }, 5000);

    element.one('hidden.bs.tooltip', () => {
      tooltip.setContent({
        '.tooltip-inner': 'Copy to Clipboard'
      });
    });
  } else {
    try {
      await copyToClipboard(content);
    } catch (e) {
      console.error('Failed to copy to clipboard');
      console.error(e);
    }
  }
}

/**
 * Processes an AJAX error object and extracts meaningful error messages.
 *
 * @param {Object|Array} err - The error object or an array containing the error object.
 *                             It may include properties such as responseJSON, responseText, status, and statusText.
 * @return {string} A descriptive error message based on the provided error object or "Unexpected error" if no details are available.
 */
export function ajaxErrorText(err) {
  const jq = Array.isArray(err) ? err[0] : err;

  if (jq?.responseJSON) {
    const j = jq.responseJSON;
    return j.msg || j.error || j.message || JSON.stringify(j);
  }

  if (typeof jq?.responseText === 'string' && jq.responseText.trim()) {
    try {
      const j = JSON.parse(jq.responseText);
      return j.msg || j.error || j.message || jq.responseText.trim();
    } catch {
      return jq.responseText.trim();
    }
  }

  if (jq?.status) {
    return `${jq.status} ${jq.statusText || ''}`.trim();
  }

  return 'Unexpected error';
}

/**
 * Detects the digit group separator and the decimal separator used in the local numeric format.
 *
 * The method utilizes the `Intl.NumberFormat` API to determine the separators
 * for grouping digits and decimals based on the current locale settings.
 *
 * @return {Object} An object containing the following properties:
 * - `groupSeparator` (string): The character used to separate groups of digits (e.g., thousands separator).
 * - `decimalSeparator` (string): The character used as the decimal point separator.
 */
export function detectDigitSeparators() {
  const groupSeparator = Intl.NumberFormat().format(1000).replace(/\d/g, '');
  const decimalSeparator = Intl.NumberFormat().format(0.1).replace(/\d/g, '');
  return {
    groupSeparator,
    decimalSeparator
  };
}

/**
 * Class representing a counter
 *
 * @class
 * @extends Map
 */
export class Counter extends Map {

  /**
     * @inheritDoc
     * @override
     */
  get(key) {
    return super.get(key) ?? 0;
  }

  /**
     * Increase the counter for a given key by value.
     * If the key doesn't exist, its initial value is set to 0.
     *
     * @param key
     * @param value
     * @return {Counter}
     */
  increment(key, value = 1) {
    const base = this.get(key);
    this.set(key, base + value);
    return this;
  }

  /**
     * Merges two Counters and returns a new object
     *
     * @param other
     * @return {Counter}
     */
  extend(other) {
    const result = new this.constructor(this);

    for (const [key, value] of other) {
      result.increment(key, value);
    }

    return result;
  }

  /**
     * Merges two Counters in-place
     *
     * @param other
     * @return {Counter}
     */
  iextend(other) {
    for (const [key, value] of other) {
      this.increment(key, value);
    }

    return this;
  }
}
