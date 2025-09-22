"""
Test cases for validation system with real-world framework code examples.

This file contains various code samples that should be properly handled
by the validation ignore pattern system.
"""

import json
import tempfile
from pathlib import Path
from validation_config import get_validation_config
from file_tools_mcp import FileToolsMCP


def test_fastapi_example():
    """Test FastAPI application code that should have minimal validation issues."""
    
    fastapi_code = '''
from fastapi import FastAPI, HTTPException, Depends, Query, Path
from fastapi.security import HTTPBearer, OAuth2PasswordBearer
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn

app = FastAPI(title="User API", version="1.0.0")
security = HTTPBearer()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class UserBase(BaseModel):
    email: str = Field(..., description="User email address")
    name: str = Field(..., min_length=1, max_length=100)
    
    @validator('email')
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserResponse(UserBase):
    id: int
    is_active: bool = True

    class Config:
        orm_mode = True

@app.get("/")
async def root():
    return {"message": "Welcome to User API"}

@app.get("/users", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_database)
):
    return db.query(User).offset(skip).limit(limit).all()

@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int = Path(..., gt=0),
    db: Session = Depends(get_database)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/users", response_model=UserResponse)
async def create_user(
    user: UserCreate,
    db: Session = Depends(get_database)
):
    db_user = User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int = Path(..., gt=0),
    user_update: UserCreate,
    db: Session = Depends(get_database)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user

@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int = Path(..., gt=0),
    db: Session = Depends(get_database)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

def get_database():
    """Database dependency."""
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
'''
    
    return fastapi_code


def test_pydantic_models_example():
    """Test Pydantic models that should be ignored."""
    
    pydantic_code = '''
from pydantic import BaseModel, Field, validator, root_validator
from pydantic.types import EmailStr, SecretStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    MODERATOR = "moderator"

class Address(BaseModel):
    street: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=50)
    state: str = Field(..., min_length=2, max_length=2)
    zip_code: str = Field(..., regex=r'^\d{5}(-\d{4})?$')
    country: str = Field(default="US", max_length=2)
    
    @validator('state')
    def validate_state(cls, v):
        return v.upper()
    
    class Config:
        schema_extra = {
            "example": {
                "street": "123 Main St",
                "city": "Anytown", 
                "state": "CA",
                "zip_code": "12345",
                "country": "US"
            }
        }

class UserProfile(BaseModel):
    id: Optional[int] = None
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=20, regex=r'^[a-zA-Z0-9_]+$')
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    role: UserRole = UserRole.USER
    address: Optional[Address] = None
    phone: Optional[str] = Field(None, regex=r'^\+?1?\d{9,15}$')
    date_of_birth: Optional[datetime] = None
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    
    @validator('username')
    def validate_username(cls, v):
        if v.lower() in ['admin', 'root', 'system']:
            raise ValueError('Username not allowed')
        return v
    
    @validator('date_of_birth')
    def validate_age(cls, v):
        if v and (datetime.now() - v).days < 18 * 365:
            raise ValueError('User must be 18 or older')
        return v
    
    @root_validator
    def validate_admin_requirements(cls, values):
        if values.get('role') == UserRole.ADMIN:
            if not values.get('phone'):
                raise ValueError('Admin users must have phone number')
        return values
    
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
    
    def to_dict(self) -> Dict[str, Any]:
        return self.dict(exclude={'metadata'})
    
    class Config:
        orm_mode = True
        validate_assignment = True
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }

class UserCreateRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=20)
    password: SecretStr = Field(..., min_length=8)
    first_name: str
    last_name: str
    address: Optional[Address] = None
    phone: Optional[str] = None
    
    @validator('password')
    def validate_password_strength(cls, v):
        password = v.get_secret_value()
        if not any(c.isupper() for c in password):
            raise ValueError('Password must contain uppercase letter')
        if not any(c.islower() for c in password):
            raise ValueError('Password must contain lowercase letter')
        if not any(c.isdigit() for c in password):
            raise ValueError('Password must contain digit')
        return v

class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[Address] = None
    phone: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        extra = "forbid"  # Don't allow extra fields

def create_user_from_request(request: UserCreateRequest) -> UserProfile:
    """Convert create request to user profile."""
    user_data = request.dict(exclude={'password'})
    user_data['role'] = UserRole.USER
    return UserProfile(**user_data)
'''
    
    return pydantic_code


def test_sqlalchemy_models_example():
    """Test SQLAlchemy models that should be ignored."""
    
    sqlalchemy_code = '''
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import create_engine, MetaData
from datetime import datetime
import uuid

Base = declarative_base()
metadata = MetaData()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    password_hash = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    metadata = Column(JSONB, default=dict)
    
    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    
    def __repr__(self):
        return f"<User(username='{self.username}', email='{self.email}')>"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

class UserProfile(Base):
    __tablename__ = 'user_profiles'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    bio = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    location = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    social_links = Column(JSONB, default=dict)
    
    # Relationship
    user = relationship("User", back_populates="profile")
    
    def __repr__(self):
        return f"<UserProfile(user_id={self.user_id})>"

class Post(Base):
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    summary = Column(String(500), nullable=True)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    view_count = Column(Integer, default=0, nullable=False)
    tags = Column(JSONB, default=list)
    
    # Relationships
    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Post(title='{self.title}', author_id={self.author_id})>"

class Comment(Base):
    __tablename__ = 'comments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    content = Column(Text, nullable=False)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    parent_id = Column(Integer, ForeignKey('comments.id'), nullable=True)
    is_approved = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    post = relationship("Post", back_populates="comments")
    author = relationship("User")
    parent = relationship("Comment", remote_side=[id])
    
    def __repr__(self):
        return f"<Comment(post_id={self.post_id}, author_id={self.author_id})>"

# Database setup
def create_database_engine(database_url: str):
    """Create database engine with proper configuration."""
    engine = create_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )
    return engine

def create_session_factory(engine):
    """Create session factory."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal

def get_database_session(session_factory) -> Session:
    """Get database session."""
    db = session_factory()
    try:
        yield db
    finally:
        db.close()

def create_tables(engine):
    """Create all tables."""
    Base.metadata.create_all(bind=engine)

def drop_tables(engine):
    """Drop all tables."""
    Base.metadata.drop_all(bind=engine)
'''
    
    return sqlalchemy_code


def test_pytest_example():
    """Test pytest test files that should be ignored."""
    
    pytest_code = '''
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app, get_database
from models import User, Post

# Test client setup
client = TestClient(app)

@pytest.fixture
def mock_db():
    """Mock database session."""
    return Mock(spec=Session)

@pytest.fixture
def sample_user():
    """Sample user for testing."""
    return User(
        id=1,
        email="test@example.com",
        username="testuser",
        first_name="Test",
        last_name="User",
        is_active=True
    )

@pytest.fixture
def sample_post(sample_user):
    """Sample post for testing."""
    return Post(
        id=1,
        title="Test Post",
        content="This is a test post content",
        author_id=sample_user.id,
        is_published=True
    )

class TestUserAPI:
    """Test user API endpoints."""
    
    def test_get_users_empty(self, mock_db):
        """Test getting users when database is empty."""
        mock_db.query.return_value.offset.return_value.limit.return_value.all.return_value = []
        
        with patch('main.get_database', return_value=mock_db):
            response = client.get("/users")
        
        assert response.status_code == 200
        assert response.json() == []
    
    def test_get_users_with_data(self, mock_db, sample_user):
        """Test getting users with data."""
        mock_db.query.return_value.offset.return_value.limit.return_value.all.return_value = [sample_user]
        
        with patch('main.get_database', return_value=mock_db):
            response = client.get("/users")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]['email'] == 'test@example.com'
    
    def test_get_user_by_id_found(self, mock_db, sample_user):
        """Test getting user by ID when user exists."""
        mock_db.query.return_value.filter.return_value.first.return_value = sample_user
        
        with patch('main.get_database', return_value=mock_db):
            response = client.get("/users/1")
        
        assert response.status_code == 200
        data = response.json()
        assert data['id'] == 1
        assert data['email'] == 'test@example.com'
    
    def test_get_user_by_id_not_found(self, mock_db):
        """Test getting user by ID when user doesn't exist."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with patch('main.get_database', return_value=mock_db):
            response = client.get("/users/999")
        
        assert response.status_code == 404
        assert "User not found" in response.json()['detail']
    
    @pytest.mark.parametrize("user_data,expected_status", [
        ({"email": "test@example.com", "username": "test", "password": "password123"}, 200),
        ({"email": "invalid-email", "username": "test", "password": "password123"}, 422),
        ({"email": "test@example.com", "username": "", "password": "password123"}, 422),
        ({"email": "test@example.com", "username": "test", "password": "123"}, 422),
    ])
    def test_create_user_validation(self, user_data, expected_status, mock_db):
        """Test user creation with various validation scenarios."""
        if expected_status == 200:
            mock_user = User(id=1, **user_data)
            mock_db.add.return_value = None
            mock_db.commit.return_value = None
            mock_db.refresh.return_value = None
            
            with patch('main.get_database', return_value=mock_db):
                with patch('main.User', return_value=mock_user):
                    response = client.post("/users", json=user_data)
        else:
            response = client.post("/users", json=user_data)
        
        assert response.status_code == expected_status

class TestPostAPI:
    """Test post API endpoints."""
    
    def test_create_post(self, mock_db, sample_user):
        """Test creating a new post."""
        post_data = {
            "title": "New Post",
            "content": "This is new post content",
            "author_id": sample_user.id
        }
        
        mock_post = Post(id=1, **post_data)
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('main.get_database', return_value=mock_db):
            with patch('main.Post', return_value=mock_post):
                response = client.post("/posts", json=post_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == 'New Post'
    
    def test_get_posts_by_author(self, mock_db, sample_post):
        """Test getting posts by author."""
        mock_db.query.return_value.filter.return_value.all.return_value = [sample_post]
        
        with patch('main.get_database', return_value=mock_db):
            response = client.get(f"/posts?author_id={sample_post.author_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]['title'] == 'Test Post'

@pytest.mark.integration
class TestIntegration:
    """Integration tests."""
    
    def test_user_post_workflow(self):
        """Test complete user and post creation workflow."""
        # Create user
        user_data = {
            "email": "integration@example.com",
            "username": "integration",
            "password": "securepassword123"
        }
        
        with patch('main.get_database') as mock_db:
            mock_db.return_value.add.return_value = None
            mock_db.return_value.commit.return_value = None
            mock_db.return_value.refresh.return_value = None
            
            user_response = client.post("/users", json=user_data)
            assert user_response.status_code == 200
            
            # Create post for user
            post_data = {
                "title": "Integration Test Post",
                "content": "This post was created in integration test",
                "author_id": 1
            }
            
            post_response = client.post("/posts", json=post_data)
            assert post_response.status_code == 200

def test_database_operations():
    """Test database operations."""
    with patch('models.create_database_engine') as mock_create_engine:
        with patch('models.create_session_factory') as mock_create_session:
            engine = mock_create_engine.return_value
            session_factory = mock_create_session.return_value
            
            assert engine is not None
            assert session_factory is not None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
    
    return pytest_code


def test_suspicious_code_example():
    """Example of code with actual security issues that should trigger warnings."""
    
    suspicious_code = '''
import os
import subprocess
import pickle
import eval as evil_eval
from urllib.request import urlopen

class DangerousOperations:
    """This class contains dangerous operations that should trigger warnings."""
    
    def execute_system_command(self, user_input):
        """DANGEROUS: Direct system command execution."""
        # This should trigger a high-severity warning
        os.system(f"echo {user_input}")
        return "Command executed"
    
    def unsafe_subprocess_call(self, command_parts):
        """DANGEROUS: Subprocess without input validation."""
        # This should trigger warnings
        subprocess.call(command_parts)
        subprocess.run(command_parts, shell=True)  # Even more dangerous
        subprocess.Popen(command_parts, shell=True)
    
    def dangerous_eval_usage(self, code_string):
        """DANGEROUS: Using eval on user input."""
        # These should trigger high-severity warnings
        result = eval(code_string)
        exec(code_string)
        return result
    
    def unsafe_deserialization(self, data):
        """DANGEROUS: Unsafe pickle deserialization."""
        # This should trigger a high-severity warning
        return pickle.loads(data)
    
    def unsafe_file_operations(self, filename):
        """DANGEROUS: Unsafe file operations."""
        # These should trigger warnings
        os.unlink(filename)
        os.remove(filename)
        os.rmdir(filename)
        
        import shutil
        shutil.rmtree(filename)  # Very dangerous
    
    def unsafe_network_operations(self, url):
        """DANGEROUS: Unsafe network operations."""
        # This should trigger warnings
        response = urlopen(url)  # No validation
        return response.read()
    
    def weak_cryptography(self, data):
        """DANGEROUS: Weak cryptographic functions."""
        import hashlib
        import random
        
        # These should trigger warnings
        md5_hash = hashlib.md5(data.encode()).hexdigest()  # Weak
        sha1_hash = hashlib.sha1(data.encode()).hexdigest()  # Weak
        weak_random = random.random()  # Weak for security
        
        return md5_hash, sha1_hash, weak_random
    
    def dynamic_code_loading(self, module_name):
        """DANGEROUS: Dynamic code loading."""
        # These should trigger warnings
        imported_module = __import__(module_name)
        
        import importlib
        dynamic_module = importlib.import_module(module_name)
        
        return imported_module, dynamic_module

def process_user_input(user_data):
    """Function that processes user input dangerously."""
    dangerous_ops = DangerousOperations()
    
    # Multiple dangerous operations
    if 'command' in user_data:
        dangerous_ops.execute_system_command(user_data['command'])
    
    if 'code' in user_data:
        dangerous_ops.dangerous_eval_usage(user_data['code'])
    
    if 'pickle_data' in user_data:
        dangerous_ops.unsafe_deserialization(user_data['pickle_data'])

# Global dangerous variables
DANGEROUS_CONFIG = {
    'allow_eval': True,
    'allow_system_commands': True,
    'disable_security': True
}

# Dangerous function in global scope
def backdoor_access(secret_key):
    """This function name and implementation should trigger warnings."""
    if secret_key == "admin123":  # Hardcoded secret
        os.system("whoami")  # System command
        return True
    return False
'''
    
    return suspicious_code


def run_validation_test_suite():
    """Run the complete validation test suite with various code examples."""
    
    print("🔧 Running Validation Ignore Pattern Test Suite")
    print("=" * 60)
    
    tools = FileToolsMCP()
    
    # Test cases
    test_cases = [
        ("FastAPI Application", test_fastapi_example()),
        ("Pydantic Models", test_pydantic_models_example()),
        ("SQLAlchemy Models", test_sqlalchemy_models_example()),
        ("Pytest Test Suite", test_pytest_example()),
        ("Suspicious Code", test_suspicious_code_example())
    ]
    
    results = {}
    
    for test_name, code_content in test_cases:
        print(f"\n📝 Testing: {test_name}")
        print("-" * 40)
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code_content)
            temp_path = f.name
        
        try:
            # Validate the code
            result = tools.read_file_safe(temp_path, validate=True)
            
            if result['success']:
                validation = result['validation']
                
                print(f"✅ File read successfully")
                print(f"📊 Validation Results:")
                print(f"   - Ignored: {validation.get('ignored', False)}")
                print(f"   - Total Issues: {validation.get('total_issues', 0)}")
                
                if validation.get('ignored'):
                    print(f"   - Reason: {validation.get('reason', 'Unknown')}")
                elif validation.get('total_issues', 0) > 0:
                    print(f"   - Issue Summary:")
                    
                    severity_counts = {}
                    for issue in validation.get('issues', []):
                        severity = issue.get('severity', 'unknown')
                        severity_counts[severity] = severity_counts.get(severity, 0) + 1
                    
                    for severity, count in severity_counts.items():
                        print(f"     * {severity}: {count}")
                    
                    # Show first few issues
                    issues = validation.get('issues', [])[:3]
                    if issues:
                        print(f"   - Sample Issues:")
                        for issue in issues:
                            print(f"     * Line {issue.get('line', '?')}: {issue.get('message', 'Unknown issue')}")
                
                results[test_name] = {
                    'success': True,
                    'ignored': validation.get('ignored', False),
                    'total_issues': validation.get('total_issues', 0),
                    'validation': validation
                }
            else:
                print(f"❌ File read failed: {result.get('error', 'Unknown error')}")
                results[test_name] = {
                    'success': False,
                    'error': result.get('error', 'Unknown error')
                }
        
        finally:
            # Clean up temp file
            Path(temp_path).unlink()
    
    # Summary
    print(f"\n📈 Test Suite Summary")
    print("=" * 60)
    
    for test_name, result in results.items():
        if result['success']:
            if result['ignored']:
                status = "🟡 IGNORED (by pattern)"
            elif result['total_issues'] == 0:
                status = "🟢 CLEAN (no issues)"
            elif result['total_issues'] <= 3:
                status = f"🟠 LOW ISSUES ({result['total_issues']})"
            else:
                status = f"🔴 HIGH ISSUES ({result['total_issues']})"
        else:
            status = "❌ FAILED"
        
        print(f"{test_name:20} : {status}")
    
    # Configuration statistics
    print(f"\n⚙️ Configuration Statistics")
    print("-" * 40)
    stats = tools.get_validation_statistics()
    config_summary = stats['config_summary']
    pattern_stats = stats['pattern_statistics']
    
    print(f"Total Patterns: {config_summary.get('total_patterns', 0)}")
    print(f"  - Functions: {pattern_stats.get('function_patterns', 0)}")
    print(f"  - Imports: {pattern_stats.get('import_patterns', 0)}")
    print(f"  - Classes: {pattern_stats.get('class_patterns', 0)}")
    print(f"  - Attributes: {pattern_stats.get('attribute_patterns', 0)}")
    print(f"  - Files: {pattern_stats.get('file_patterns', 0)}")
    print(f"Cache Entries: {pattern_stats.get('cache_entries', 0)}")
    print(f"Suspicious Patterns: {stats.get('suspicious_patterns', 0)}")
    
    return results


if __name__ == "__main__":
    # Run the validation test suite
    results = run_validation_test_suite()
    
    # Print JSON results for detailed analysis
    print(f"\n🔍 Detailed Results (JSON):")
    print(json.dumps(results, indent=2, default=str))