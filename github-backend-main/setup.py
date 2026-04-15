from setuptools import setup, find_packages

setup(
    name="suprwise",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "aiosqlite",
        "pydantic",
        "bcrypt",
        "python-jose",
    ],
)