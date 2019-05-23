import './types';
import { NodeTypeTS } from './node-types';
import { _insertBefore, _removeChild } from './document-utils';
import { isDocument, isText, isElement, isDocumentFragment, isAttr, asChildNode } from './utils';
import { getTextContent, cloneNode } from './node-utils';
import { serializeToString } from './serializer/serialize';
import { DummyNode } from './dummy/dummy-node';
import { VisibleNamespaces, NodeFilterTS } from './types';

/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-1950641247
 */
export class NodeImpl extends DummyNode {
  static readonly ELEMENT_NODE = NodeTypeTS.ELEMENT_NODE;
  readonly ELEMENT_NODE = NodeTypeTS.ELEMENT_NODE;
  static readonly ATTRIBUTE_NODE = NodeTypeTS.ATTRIBUTE_NODE;
  readonly ATTRIBUTE_NODE = NodeTypeTS.ATTRIBUTE_NODE;
  static readonly TEXT_NODE = NodeTypeTS.TEXT_NODE;
  readonly TEXT_NODE = NodeTypeTS.TEXT_NODE;
  static readonly CDATA_SECTION_NODE = NodeTypeTS.CDATA_SECTION_NODE;
  readonly CDATA_SECTION_NODE = NodeTypeTS.CDATA_SECTION_NODE;
  static readonly ENTITY_REFERENCE_NODE = NodeTypeTS.ENTITY_REFERENCE_NODE;
  readonly ENTITY_REFERENCE_NODE = NodeTypeTS.ENTITY_REFERENCE_NODE;
  static readonly ENTITY_NODE = NodeTypeTS.ENTITY_NODE;
  readonly ENTITY_NODE = NodeTypeTS.ENTITY_NODE;
  static readonly PROCESSING_INSTRUCTION_NODE = NodeTypeTS.PROCESSING_INSTRUCTION_NODE;
  readonly PROCESSING_INSTRUCTION_NODE = NodeTypeTS.PROCESSING_INSTRUCTION_NODE;
  static readonly COMMENT_NODE = NodeTypeTS.COMMENT_NODE;
  readonly COMMENT_NODE = NodeTypeTS.COMMENT_NODE;
  static readonly DOCUMENT_NODE = NodeTypeTS.DOCUMENT_NODE;
  readonly DOCUMENT_NODE = NodeTypeTS.DOCUMENT_NODE;
  static readonly DOCUMENT_TYPE_NODE = NodeTypeTS.DOCUMENT_TYPE_NODE;
  readonly DOCUMENT_TYPE_NODE = NodeTypeTS.DOCUMENT_TYPE_NODE;
  static readonly DOCUMENT_FRAGMENT_NODE = NodeTypeTS.DOCUMENT_FRAGMENT_NODE;
  readonly DOCUMENT_FRAGMENT_NODE = NodeTypeTS.DOCUMENT_FRAGMENT_NODE;
  static readonly NOTATION_NODE = NodeTypeTS.NOTATION_NODE;
  readonly NOTATION_NODE = NodeTypeTS.NOTATION_NODE;

  nodeType: number;
  nodeName: string;
  firstChild: ChildNode | null = null;
  lastChild: ChildNode | null = null;
  previousSibling: Node | null = null;
  nextSibling: ChildNode | null = null;
  parentNode: Node & ParentNode | null = null;
  childNodes: NodeListOf<ChildNode> = null as never; // todo: use empty list instead of null maybe
  ownerDocument: Document;
  nodeValue: string | null = null;
  namespaceURI: string | null = null;
  prefix: string | null = null;

  lineNumber?: number;
  columnNumber?: number;

  // value: string | null = null; // todo: what is the purpose of this

  // ata: string | null = null;

  // Modified in DOM Level 2:
  insertBefore<T extends Node>(newChild: T, refChild: Node | null): T {
    //raises
    return _insertBefore(this, asChildNode(newChild), refChild == null ? null : asChildNode(refChild));
  }
  replaceChild<T extends Node>(newChild: Node, oldChild: T): T {
    //raises
    this.insertBefore(newChild, oldChild);
    return this.removeChild(oldChild);
  }
  removeChild<T extends Node>(oldChild: T): T {
    return _removeChild(this, oldChild);
  }
  appendChild<T extends Node>(newChild: T): T {
    return this.insertBefore(newChild, null);
  }
  hasChildNodes() {
    return this.firstChild != null;
  }
  cloneNode<T extends Node>(deep: boolean): T {
    if (isDocument(this)) {
      return (cloneNode(this, this, deep) as unknown) as T;
    } else {
      return (cloneNode(this.ownerDocument!, this, deep) as unknown) as T;
    }
  }
  // Modified in DOM Level 2:
  normalize() {
    let child = this.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (next && isText(next) && isText(child)) {
        this.removeChild(next);
        child.appendData(next.data);
      } else {
        child.normalize();
        child = next;
      }
    }
  }
  // Introduced in DOM Level 2:
  isSupported(feature: string, version: string) {
    if (isDocument(this)) {
      return this.implementation.hasFeature(feature, version);
    } else {
      return this.ownerDocument!.implementation.hasFeature(feature, version);
    }
  }
  // Introduced in DOM Level 2:
  hasAttributes() {
    return isElement(this) ? this.attributes.length > 0 : false;
  }
  lookupPrefix(namespaceURI: string): string | null {
    let el: Node | null = this;
    while (el) {
      if (isElement(el)) {
        const map = el._nsMap;
        //console.dir(map)
        if (map) {
          for (let n in map) {
            if (map[n] === namespaceURI) {
              return n;
            }
          }
        }
      }

      el = isAttr(el) ? el.ownerDocument : el.parentNode; // fixme: isn't this reversed ?
    }
    return null;
  }
  // Introduced in DOM Level 3:
  lookupNamespaceURI(prefix: string): string | null {
    let el: Node | null = this;
    while (el) {
      if (isElement(el)) {
        const map = el._nsMap;
        //console.dir(map)
        if (map) {
          if (prefix in map) {
            return map[prefix];
          }
        }
      }

      el = isAttr(el) ? el.ownerDocument : el.parentNode; // fixme: isn't this reversed ?
    }
    return null;
  }
  // Introduced in DOM Level 3:
  isDefaultNamespace(namespaceURI: string) {
    const prefix = this.lookupPrefix(namespaceURI);
    return prefix == null;
  }

  toString(isHtml?: boolean, nodeFilter?: NodeFilterTS) {
    const buf: string[] = [];
    const refNode = (isDocument(this) && this.documentElement) || this;
    let prefix = refNode.prefix;
    const uri = refNode.namespaceURI;

    let visibleNamespaces: VisibleNamespaces | undefined;

    if (uri && prefix == null) {
      //console.log(prefix)
      prefix = refNode.lookupPrefix(uri);
      if (prefix == null) {
        //isHTML = true;
        visibleNamespaces = [
          { namespace: uri, prefix: null },
          //{namespace:uri,prefix:''}
        ];
      }
    }
    serializeToString(this, buf, isHtml, nodeFilter, visibleNamespaces);
    //console.log('###',this.nodeType,uri,prefix,buf.join(''))
    return buf.join('');
  }

  get textContent() {
    return getTextContent(this);
  }
  set textContent(data: string | null) {
    if (isElement(this) || isDocumentFragment(this)) {
      while (this.firstChild) {
        this.removeChild(this.firstChild);
      }
      if (data) {
        // todo: removed  || String(data), is it ok ?
        this.appendChild(this.ownerDocument.createTextNode(data));
      }
    } else {
      // this.data = data;
      // this.value = data;
      this.nodeValue = data;
    }
  }

  protected ownerDocumentInternal() {
    if (isDocument(this)) {
      return this;
    } else {
      return this.ownerDocument;
    }
  }
}