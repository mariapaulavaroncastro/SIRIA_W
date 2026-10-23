import argparse
import ipaddress
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def main():
    parser = argparse.ArgumentParser(description="Generate a disposable self-signed certificate for the local lab.")
    parser.add_argument("--certificate", type=Path, default=Path("cert.pem"))
    parser.add_argument("--private-key", type=Path, default=Path("key.pem"))
    args = parser.parse_args()

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.now(timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=2))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
            ]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    args.private_key.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    args.certificate.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    print(f"Generated disposable local certificate: {args.certificate}")


if __name__ == "__main__":
    main()
