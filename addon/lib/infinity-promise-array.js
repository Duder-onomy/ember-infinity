import ArrayProxy from '@ember/array/proxy';
import Evented from '@ember/object/evented';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';

export default ArrayProxy.extend(Evented, PromiseProxyMixin);
