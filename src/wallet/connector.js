import WalletConnect from '@walletconnect/client';

const GET_ACCOUNTS = {
  id: 6,
  jsonrpc: '2.0',
  method: 'get_accounts'
};

const GET_SIGN = {
  id:8,
  jsonrpc: '2.0',
  method: 'okt_signTransaction'
};

const OKEXCHAIN = 'okexchain';

class Connector {

  constructor() {
    this.resetConnector();
  }

  resetConnector() {
    if(this.interval) clearInterval(this.interval);
    this.walletConnector = null;
    this.account = null;
    this.address = '';
    this.interval = null;
    this.callback = {};
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
    return new Promise((resolve,reject) => {
      walletConnector.sendCustomRequest(GET_ACCOUNTS).then((res) => {
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
      console.log('call_request', payload, error);
      if (error) {
        throw error;
      }
    });

    walletConnector.on('connect', (error, payload) => {
      console.log('connect', payload);
      if (error) {
        throw error;
      }
      this.onConnect(payload);
    });

    walletConnector.on('disconnect', (error, payload) => {
      console.log('disconnect', payload);
      this.onDisconnect();
      if (error) {
        throw error;
      }
    });

    walletConnector.on('session_request',(error, payload) => {
      console.log('session_request', payload);
      if (error) {
        throw error;
      }
    });

    if (walletConnector.connected) {
      const { accounts } = walletConnector;
      this.handleConnect(accounts);
    }

    this.walletConnector = walletConnector;
  }

  async createSession() {
    const walletConnector = this.walletConnector;
    if(!walletConnector) return;
    await walletConnector.createSession();
  }

  async walletConnectInit() {
    const bridge = 'https://onchainreal.bafang.com:8443';
    const walletConnector = new WalletConnect({ bridge });
    this.walletConnector = walletConnector;

    this.subscribeToEvents();

    if (!walletConnector.connected || !walletConnector.uri) {
      console.log('create session');
      await this.createSession();
    } else {
      await this.getAccounts();
    }
  }

  killSession(callback) {
    const walletConnector = this.walletConnector;
    if (walletConnector && walletConnector.connected) {
      walletConnector.killSession();
    }
    if(callback) callback();
    else this.doCallback('sessionCancel');
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
      if(!this.walletConnector || !this.walletConnector.uri) {
        await this.walletConnectInit();
        if(!this.interval) this.interval = setInterval(() => {
          this.walletConnectInit();
        },30*1000)
      }
      session = this.walletConnector.uri;
    } finally {
      if(!session) this.killSession();
      else this.doCallback('sessionSuccess');
    }
    return session;
  }

  async sign(signMsg) {
    return new Promise((resolve,reject) => {
      console.log('发送签名数据',JSON.stringify({...GET_SIGN,params:[signMsg]}));
      this.walletConnector.sendCustomRequest({...GET_SIGN,params:[signMsg]}).then((res) => {
        res = JSON.parse(res);
        console.log(res);
        resolve(res.tx.signatures);
      }).catch(err => {
        console.log('签名失败')
        reject(err);
      });
    });
  }
}

export default new Connector();
