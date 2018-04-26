import getNested from 'get-nested';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import site from '../utils/site';
import EntityMapper from './EntityMapper';

class DrupalPage extends Component<DrupalPageProps, DrupalPageState> {
  static contextTypes = {
    hnContext: PropTypes.object,
  };

  constructor(p) {
    super(p);
    this.state = {
      dataUrl: null,
      loadingData: true,
      pageUuid: null,
    };
  }

  private entity: EntityMapper | null = null;

  /**
   * If this component exists in a tree that is invoked with the waitForHnData function, this function is invoked.
   * Only after the promise is resolved, the component will be mounted. To keep the data fetched here, we assign the
   * state to the hnContext provided by the DrupalPageContextProvider. This way, the state will be preserved trough
   * multiple renders.
   */
  async bootstrap() {
    const drupalPage = await this.loadData(this.props);
    if (drupalPage) {
      this.context.hnContext.state = {
        drupalPage: {
          componentState: drupalPage,
          dataUrl: drupalPage.dataUrl,
        },
        entities: [],
      };
    }
    return true;
  }

  /**
   * The first time this element is rendered, we always make sure the component and the Drupal page is loaded.
   */
  componentWillMount() {
    const state = getNested(() => {
      const drupalPage = this.context.hnContext.state.drupalPage;
      return drupalPage.dataUrl === this.props.url && drupalPage.componentState;
    });
    if (state) {
      this.setState(state);
    } else {
      this.loadData(this.props);
    }
  }

  /**
   * As soon as the url, mapper or asyncMapper props change, we want to load new data.
   * This always unmounts and mounts all children (Layout and ContentType).
   */
  componentWillReceiveProps(nextProps) {
    if (
      this.props.url !== nextProps.url ||
      this.props.mapper !== nextProps.mapper ||
      this.props.asyncMapper !== nextProps.asyncMapper
    ) {
      this.loadData(nextProps);
    }
  }

  /**
   * This makes sure the data for this url is ready to be rendered.
   */
  static async assureData({ url }) {
    // Get the page. If the page was already fetched before, this should be instant.
    const pageUuid = await site.getPage(url);
    if (!pageUuid) {
      throw Error('An error occurred getting a response from the server.');
    }

    return { pageUuid };
  }

  componentWillUnmount() {
    this.lastRequest = null;
  }

  lastRequest: symbol | null = null;

  async loadData({ url }: DrupalPageProps) {
    const lastRequest = Symbol(url);

    this.lastRequest = lastRequest;

    this.setState({ loadingData: true });

    // Load the data.
    const { pageUuid } = await DrupalPage.assureData({
      url,
    });

    // Check if this is still the last request.
    if (this.lastRequest !== lastRequest) {
      return;
    }

    const newState = {
      ...this.state,
      ...{ pageUuid, loadingData: false, dataUrl: url },
    };

    // Mark this component as ready. This mounts the Layout and new ContentType.
    this.setState(newState);

    return newState;
  }

  render() {
    // Mark this component as not-ready. This unmounts the Layout and old ContentType.
    // Only render if the component is ready.
    if (
      !this.props.renderWhileLoadingData &&
      this.entity &&
      !(this.entity.isReady() && !this.state.loadingData)
    ) {
      return null;
    }

    // Get props.
    const Layout = this.props.layout;

    let data = null;
    let entityMapper: JSX.Element | null = null;

    // When this is the very first render, there isn't a pageUuid in state. Then only render the Layout.
    if (this.state.pageUuid !== null) {
      // Get the data and content types with the state properties.
      data = site.getData(this.state.pageUuid);

      entityMapper = (
        <EntityMapper
          mapper={this.props.mapper}
          uuid={this.state.pageUuid}
          asyncMapper={this.props.asyncMapper}
          entityProps={{ ...this.props.pageProps, page: data }}
          ref={c => {
            this.entity = c;
          }}
        />
      );
    }

    if (!Layout) {
      return entityMapper;
    }

    return (
      <Layout
        loadingData={this.state.loadingData}
        url={this.state.dataUrl}
        page={data}
        {...this.props.layoutProps}
      >
        {entityMapper}
      </Layout>
    );
  }

  static propTypes = {
    asyncMapper: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.oneOfType([PropTypes.shape({}), PropTypes.func]),
    ]),
    layout: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
    layoutProps: PropTypes.shape({}),
    mapper: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.func]),
    pageProps: PropTypes.shape({}),
    renderWhileLoadingData: PropTypes.bool,
    url: PropTypes.string.isRequired,
  };

  static defaultProps = {
    asyncMapper: undefined,
    layout: undefined,
    layoutProps: {},
    pageProps: undefined,
    renderWhileLoadingData: false,
  };
}

export interface DrupalPageProps {
  asyncMapper?: any;
  layout?: React.ReactType;
  layoutProps?: object;
  mapper?: any;
  pageProps?: object;
  renderWhileLoadingData?: boolean;
  url: string;
}

export interface DrupalPageState {
  dataUrl: string | null;
  loadingData: any;
  pageUuid: string | null;
}

export default DrupalPage;
