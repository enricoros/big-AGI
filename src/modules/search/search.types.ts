export namespace Search {

  /// Client (Browser) -> Server (Next.js)
  export namespace API {

    export interface RequestParams {
      query: string;
      key?: string;
      cx?: string;
    }

    export type Response = Wire.Item[];

  }

  // This is the upstream API [rev-eng on 2023-04-27], for Server (Next.js) -> Upstream Server
  export namespace Wire {

    export interface RequestParams {
      key: string;
      cx: string;
      q: string;
      num: number;
      // start?: number;
      // lr?: string;
      // safe?: string;
      // sort?: string;
      // filter?: string;
      // gl?: string;
      // cr?: string;
      // googlehost?: string;
      // c2coff?: string;
      // hq?: string;
      // hl?: string;
      // siteSearch?: string;
      // siteSearchFilter?: string;
      // exactTerms?: string;
      // excludeTerms?: string;
      // linkSite?: string;
      // orTerms?: string;
      // relatedSite?: string;
      // dateRestrict?: string;
      // lowRange?: string;
      // highRange?: string;
      // searchType?: string;
      // fileType?: string;
      // rights?: string;
      // imgSize?: string;
      // imgType?: string;
      // imgColorType?: string;
      // imgDominantColor?: string;
      // alt?: string;
    }

    export interface Response {
      kind: string;
      url: {
        type: string;
        template: string;
      };
      queries: {
        request: PageStats[];
        nextPage: PageStats[];
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
      items: Item[];
    }

    interface PageStats {
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

    export interface Item {
      kind: string;
      title: string;
      htmlTitle: string;
      link: string;
      displayLink: string;
      snippet: string;
      htmlSnippet: string;
      formattedUrl: string;
      htmlFormattedUrl: string;
      // pagemap: PageMap;
    }

    /*interface PageMap {
      cse_thumbnail: Thumbnail[];
      VideoObject?: any[];
      imageobject: ImageObject[];
      broadcastevent: BroadcastEvent[];
      person: Person[];
      metatags: MetaTag[];
      videoobject: VideoObject[];
      cse_image: CSEImage[];
    }

    interface Thumbnail {
      src: string;
      width: string;
      height: string;
    }

    interface ImageObject {
      width: string;
      url: string;
      height: string;
    }

    interface BroadcastEvent {
      islivebroadcast: string;
      enddate: string;
      startdate: string;
    }

    interface Person {
      name: string;
      url: string;
    }

    interface MetaTag {
      [key: string]: string;
    }

    interface VideoObject {
      [key: string]: string;
    }

    interface CSEImage {
      src: string;
    }*/

  }

}