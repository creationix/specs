# Specification: DagCBOR

**Status: Descriptive - Draft**

DagCBOR supports the full [IPLD Data Model].

DagCBOR uses the [Concise Binary Object Representation (CBOR)] data format, which natively supports all [IPLD Data Model Kinds].

## Format

The CBOR IPLD format is called DagCBOR to disambiguate it from regular CBOR. Most CBOR objects are valid DagCBOR. The primary differences are:
  * tag `42` interpreted as CIDs
  * maps may only be keyed by strings
  * additional strictness requirements about valid data encoding forms

## Links

As with all IPLD formats, DagCBOR must be able to encode [Links]. In DagCBOR, links are the binary form of a [CID] encoded using the raw-binary identity [Multibase]. That is, the Multibase identity prefix (`0x00`) is prepended to the binary form of a CID and this new byte array is encoded into CBOR as a byte-string (major type 2), with the tag `42`.

The inclusion of the Multibase prefix exists for historical reasons and the identity prefix *must not* be omitted.

## Map Keys

In DagCBOR, map keys must be strings, as defined by the [IPLD Data Model].

## Strictness

DagCBOR requires that there exist a single way of encoding any given object, and that encoded forms contain no superfluous data that may be ignored or lost in a round-trip decode/encode.

Therefore the DagCBOR codec must:

1. Use no tags other than the CID tag (`42`). A valid DagCBOR encoder must not encode using any additional tags and a valid DagCBOR decoder must reject objects containing additional tags as invalid.
2. Use the canonical CBOR encoding defined by the the suggestions in [section 3.9 of the CBOR specification]. A valid DagCBOR decoder should reject objects not following these restrictions as invalid. Specifically:
   * Integers must be as small as possible.
   * The expression of lengths in major types 2 through 5 must be as short as possible.
   * The keys in every map must be sorted lowest value to highest. Sorting is performed on the bytes of the representation of the keys.
     - If two keys have different lengths, the shorter one sorts earlier;
     - If two keys have the same length, the one with the lower value in (byte-wise) lexical order sorts earlier.
   * Indefinite-length items must be made into definite-length items.


[IPLD Data Model]: ../../data-model-layer/data-model.md
[Concise Binary Object Representation (CBOR)]: https://tools.ietf.org/html/rfc7049
[IPLD Data Model Kinds]: ../../data-model-layer/data-model.md#kinds
[Links]: ../../data-model-layer/data-model.md#link-kind
[CIDs]: ../CID.md
[Multibase]: https://github.com/multiformats/multibase
[section 3.9 of the CBOR specification]: https://tools.ietf.org/html/rfc7049#section-3.9