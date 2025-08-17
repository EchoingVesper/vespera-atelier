# Vespera Scriptorium Module Relationships

## Core Architecture Diagram

```mermaid
graph TD
    subgraph "Current Implementation"
        FM[FileManager] --> Parser
        Parser --> Chunker
        Chunker --> LLMC[LLMClient]
        LLMC --> PTM[PromptTemplateManager]
        LLMC --> OP[OllamaProvider]
        LLMC --> LSP[LMStudioProvider]
        PTM --> Writer
        UI[UI Components] --> FM
    end
    
    subgraph "Future Semantic Search"
        Chunker --> EG[Embedding Generator]
        LLMC --> EG
        EG --> VS[Vector Storage]
        VS --> SS[Similarity Search]
        SS --> SUI[Search UI]
    end
    
    subgraph "Other Future Modules"
        Chunker --> CA[Conversational Assistant]
        LLMC --> CA
        PTM --> CA
        
        Chunker --> IS[Inline Suggestions]
        LLMC --> IS
        PTM --> IS
        
        FM --> ST[Schema Templates]
        ST --> DV[Dataview/Codex Views]
        DV --> RM[Relationship Map]
    end
    
    classDef current fill:#d4f1f9,stroke:#05728f,stroke-width:2px;
    classDef future fill:#ffe6cc,stroke:#d79b00,stroke-width:2px;
    classDef semantic fill:#d5e8d4,stroke:#82b366,stroke-width:2px;
    
    class FM,Parser,Chunker,LLMC,PTM,OP,LSP,UI,Writer current;
    class CA,IS,ST,DV,RM future;
    class EG,VS,SS,SUI semantic;
```

## Implementation Progress

```mermaid
pie
    title "Module Implementation Progress"
    "Summarization (1.1)" : 80
    "Semantic Search (2.1)" : 30
    "Other Modules" : 5
```

## Milestone Timeline

```mermaid
gantt
    title Vespera Scriptorium Development Timeline
    dateFormat  YYYY-MM-DD
    section Completed
    Milestone 1-5 (Summarization Core)    :done, m1, 2025-04-01, 2025-04-30
    section Current
    Milestone 5.5 (Framework Alignment)   :active, m55, 2025-04-30, 2025-05-05
    section Upcoming
    Milestone 6 (Writer & Summaries)      :m6, 2025-05-05, 2025-05-15
    Milestone 7 (Semantic Search Start)   :m7, 2025-05-15, 2025-06-01
    Milestone 8 (Semantic Search Complete):m8, 2025-06-01, 2025-06-15
```

## Semantic Search Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as UI Components
    participant FM as FileManager
    participant Parser
    participant Chunker
    participant LLMC as LLMClient
    participant VS as Vector Storage
    participant SS as Similarity Search
    
    Note over User,SS: Indexing Phase
    User->>UI: Select files to index
    UI->>FM: Request files
    FM->>Parser: Parse files
    Parser->>Chunker: Chunk content
    Chunker->>LLMC: Request embeddings
    LLMC->>VS: Store embeddings
    
    Note over User,SS: Search Phase
    User->>UI: Enter search query
    UI->>LLMC: Embed query
    LLMC->>SS: Find similar chunks
    SS->>VS: Retrieve chunks
    VS->>UI: Display results
    UI->>User: Show matches
```

These diagrams illustrate how our current implementation provides the foundation for future semantic search capabilities and other modules in the expanded Vespera Scriptorium vision.