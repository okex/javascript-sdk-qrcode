import WalletConnect from '@walletconnect/client';

const GET_ACCOUNTS = {
  id: 6,
  method: 'get_accounts'
};

const OKEXCHAIN = 'okexchain';

class Connector {

  constructor() {
    this.resetConnector();
  }

  resetConnector() {
    this.walletConnector = null;
    this.session = '';
    this.account = null;
    this.success = null;
    this.error = null;
    this.callback = {};
  }

  /**
   * 接受移动端定时推送的sign
   */
  onSendSign(payload) {
    const { sign, timestamp } = payload.params[0];
    // console.log(sign, timestamp);
  }

  handleConnect(accounts) {
    this.account = accounts[0];
  }

  async onConnect(payload) {
    try {
      await this.getAccounts();
      const { accounts } = payload.params[0];
      this.handleConnect(accounts);
      if(!this.address) throw new Error;
      this.doCallback('success',{address: this.address});
    } catch {
      this.doCallback('error');
    }
  }

  onDisconnect() {
    this.killSession();
  }
  
  async getAccounts() {
    const walletConnector = this.walletConnector;
    const customRequest = {
      id: GET_ACCOUNTS.id,
      jsonrpc: '2.0',
      method: GET_ACCOUNTS.method,
    };
    return new Promise((resolve,reject) => {
      walletConnector.sendCustomRequest(customRequest).then((res) => {
        const okexchainAccount = res.find((account) => {
          return account.address.startsWith(OKEXCHAIN);
        });
        if (okexchainAccount) {
          const { address } = okexchainAccount;
          this.address = address;
        }
        resolve(this.address);
      }).catch(reject);
    });
  }

  async subscribeToEvents() {
    const walletConnector = this.walletConnector;
    if (!walletConnector) {
      return;
    }
    walletConnector.on('call_request', (error, payload) => {
      console.log('call_request', payload);
      if (error) {
        throw error;
      }
      this.onSendSign(payload);
    });

    walletConnector.on('connect', (error, payload) => {
      console.log('connect', payload);
      if (error) {
        throw error;
      }
      this.onConnect(payload);
    });

    walletConnector.on('disconnect', (error) => {
      console.log('disconnect', payload);
      if (error) {
        throw error;
      }
      this.onDisconnect();
    });

    if (walletConnector.connected) {
      const { accounts } = walletConnector;
      this.handleConnect(accounts);
    }

    this.walletConnector = walletConnector;
  }

  async walletConnectInit(disConnectedCallback) {
    const bridge = 'https://onchainreal.bafang.com:8443';
    const walletConnector = new WalletConnect({ bridge });
    this.walletConnector = walletConnector;

    if (!walletConnector.connected) {
      if (disConnectedCallback) {
        disConnectedCallback();
      }
      // create new session
      await walletConnector.createSession();

      // get uri for QR Code modal
      const uri = walletConnector.uri;
      this.session = uri;
    }

    this.subscribeToEvents();
  }

  killSession() {
    const walletConnector = this.walletConnector;
    if (walletConnector && walletConnector.connected) {
      walletConnector.killSession();
    }
    this.doCallback('sessionCancel');
    this.resetConnector();
  }

  setCallback(callback={}) {
    this.callback = callback;
  }

  doCallback(type,params) {
    if(typeof this.callback[type] === 'function' )this.callback[type](params);
  }
  
  async getSession(callback) {
    this.setCallback(callback);
    let session = '';
    try {
      if(!this.walletConnector || !this.session) {
        await this.walletConnectInit();
      }
      session = this.session;
    } finally {
      if(!session) this.doCallback('sessionFail');
      else this.doCallback('sessionSuccess');
    }
    return session;
  }

}

export default new Connector();
