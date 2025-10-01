'use strict';

export const API_BASE_URL = 'https://api.spocks.club';

/**
 * Makes an asynchronous API request to the specified route.
 *
 * @param {string} route - The API endpoint route to request data from.
 * @param {?any} [fallback=null] - Optional fallback value to return in case the request fails.
 * @param {boolean} [bypassCache=false] - Whether to bypass the cache when making the request.
 * @return {Promise<object|object[]>} A promise that resolves with the API response data or the fallback value, and rejects with an error if no fallback is provided and the request fails.
 */
export async function makeApiRequest(route, fallback = null, bypassCache = false) {
  const promise = Promise.withResolvers();

  $.ajax({
    method: 'GET',
    dataType: 'json',
    cache: !bypassCache,
    timeout: 10000,
    url: `${API_BASE_URL}/${route}`,
    success: ( /** object | object[] */ data, /** string */ textStatus, /** object */ jqXHR) => {
      promise.resolve(data);
    },
    error: ( /** object */ jqXHR, /** string */ textStatus, /** string */ errorThrown) => {
      console.error(`[API] Error fetching /${route}: ${jqXHR.status} ${jqXHR.responseText ?? textStatus}`);

      if (fallback !== null) {
        promise.resolve(fallback);
      } else {
        promise.reject(new Error(errorThrown));
      }
    }
  });

  return promise.promise;
}
