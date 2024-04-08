export namespace Search {

  /// Client (Browser) -> Server (Next.js)
  export namespace API {

    export interface BriefResult {
      title: string;
      link: string;
      snippet: string;
      // htmlTitle: string;
      // htmlSnippet: string;
      // displayLink: string;
      // formattedUrl: string;
    }

  }

  // This is the upstream API [rev-eng on 2023-04-27], for Server (Next.js) -> Upstream Server
  export namespace Wire {

    // https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
    export interface RequestParams {
      key: string; // API key
      cx: string; // Programmable Search Engine ID
      q: string; // Query
      num: number; // Number of search results to return (1 to 10)
      start?: number; // Index of the first result to return
      // lr?: string; // Restricts the search to documents written in a particular language (e.g., lr=lang_ja)
      // safe?: string; // Search safety level ("active" or "off")
      // sort?: string; // Sort expression to apply to the results (e.g., sort=date)
      // filter?: string; // Controls turning on or off the duplicate content filter ("0" or "1")
      // gl?: string; // Geolocation of end user (two-letter country code)
      // cr?: string; // Restricts search results to documents originating in a particular country
      // googlehost?: string; // Deprecated. Use the gl parameter for a similar effect
      // c2coff?: string; // Enables or disables Simplified and Traditional Chinese Search ("1" or "0")
      // hq?: string; // Appends the specified query terms to the query, as if they were combined with a logical AND operator
      // hl?: string; // Sets the user interface language
      // siteSearch?: string; // Specifies a given site which should always be included or excluded from results
      // siteSearchFilter?: string; // Controls whether to include or exclude results from the site named in the siteSearch parameter ("e" or "i")
      // exactTerms?: string; // Identifies a phrase that all documents in the search results must contain
      // excludeTerms?: string; // Identifies a word or phrase that should not appear in any documents in the search results
      // linkSite?: string; // Specifies that all search results should contain a link to a particular URL
      // orTerms?: string; // Provides additional search terms to check for in a document, where each document in the search results must contain at least one of the additional search terms
      // relatedSite?: string; // Specifies that all search results should be pages that are related to the specified URL
      // dateRestrict?: string; // Restricts results to URLs based on date (e.g., d[number], w[number], m[number], y[number])
      // lowRange?: string; // Specifies the starting value for a search range
      // highRange?: string; // Specifies the ending value for a search range
      // searchType?: string; // Specifies the search type: image
      // fileType?: string; // Restricts results to files of a specified extension
      // rights?: string; // Filters based on licensing (e.g., cc_publicdomain, cc_attribute, cc_sharealike, cc_noncommercial, cc_nonderived)
      // imgSize?: string; // Returns images of a specified size (e.g., "huge", "icon", "large", "medium", "small", "xlarge", "xxlarge")
      // imgType?: string; // Returns images of a type (e.g., "clipart", "face", "lineart", "stock", "photo", "animated")
      // imgColorType?: string; // Returns black and white, grayscale, transparent, or color images (e.g., "color", "gray", "mono", "trans")
      // imgDominantColor?: string; // Returns images of a specific dominant color (e.g., "black", "blue", "brown", "gray", "green", "orange", "pink", "purple", "red", "teal", "white", "yellow")
      // alt?: string; // Alternative representation type
    }

    export interface SearchResponse {
      kind: string;
      url: {
        type: string;
        template: string;
      };
      queries: {
        request: QueryMetadata[];
        nextPage: QueryMetadata[];
      };
      context: {
        title: string;
      };
      searchInformation: {
        searchTime: number;
        formattedSearchTime: string;
        totalResults: string;
        formattedTotalResults: string;
      };
      items: Result[];
    }

    interface QueryMetadata {
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }

    export interface Result {
      kind: string; // A unique identifier for the type of current object, 'customsearch#result'
      title: string; // The title of the search result, in plain text
      htmlTitle: string; // The title of the search result, in HTML
      link: string; // The full URL to which the search result is pointing
      displayLink: string; // An abridged version of this search result’s URL
      snippet: string; // The snippet of the search result, in plain text
      htmlSnippet: string; // The snippet of the search result, in HTML
      cacheId: string; // Indicates the ID of Google's cached version of the search result
      formattedUrl: string; // The URL displayed after the snippet for each search result
      htmlFormattedUrl: string; // The HTML-formatted URL displayed after the snippet for each search result
      // pagemap: PageMap; // Contains PageMap information for this search result
      // mime: string; // The MIME type of the search result
      // fileFormat: string; // The file format of the search result
      // image: {
      //   contextLink: string; // A URL pointing to the webpage hosting the image
      //   height: number; // The height of the image, in pixels
      //   width: number; // The width of the image, in pixels
      //   byteSize: number; // The size of the image, in pixels
      //   thumbnailLink: string; // A URL to the thumbnail image
      //   thumbnailHeight: number; // The height of the thumbnail image, in pixels
      //   thumbnailWidth: number; // The width of the thumbnail image, in pixels
      // };
      // labels: {
      //   name: string; // The name of a refinement label, use displayName for UI
      //   displayName: string; // The display name of a refinement label, for UI
      //   label_with_op: string; // Refinement label and the associated refinement operation
      // }[];
    }

    /*interface PageMap {
      cse_thumbnail: {
        src: string;
        width: string;
        height: string;
      }[];
      VideoObject?: any[];
      imageobject: {
        width: string;
        url: string;
        height: string;
      }[];
      broadcastevent: {
        islivebroadcast: string;
        enddate: string;
        startdate: string;
      }[];
      person: {
        name: string;
        url: string;
      }[];
      metatags: {
        [key: string]: string;
      }[];
      videoobject: {
        [key: string]: string;
      }[];
      cse_image: {
        src: string;
      }[];
    }*/

  }

}